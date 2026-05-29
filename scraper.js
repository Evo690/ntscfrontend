(function () {
  const DEFAULT_PAGE_SIZE = 100;

  function assertPortalReady() {
    if (typeof API_CONFIG === 'undefined' || typeof API_ENDPOINTS === 'undefined') {
      throw new Error('Portal API globals are not loaded. Load this after core.js.');
    }
    if (typeof loginProxyFetch !== 'function' || typeof authHeaders !== 'function') {
      throw new Error('Portal fetch helpers are not loaded. Load this after core.js.');
    }
    if (!API_CONFIG.token) {
      throw new Error('Login first, then run the scraper from the browser console.');
    }
  }

  function unique(values) {
    return [...new Set(values.map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
  }

  function getDefaultYears() {
    const fromSelectors = [...document.querySelectorAll('#exam-year-selector option, #era-year-selector option, #tt-year-selector option')]
      .map(option => option.value);
    const currentYear = new Date().getFullYear();
    const broadRange = Array.from({ length: currentYear - 2020 + 2 }, (_, i) => 2020 + i);
    return unique([...fromSelectors, ...broadRange]);
  }

  function getYearsFromOptions(options) {
    if (options.years?.length) return unique(options.years);
    const startYear = Number(options.startYear);
    const endYear = Number(options.endYear);
    if (Number.isFinite(startYear) && Number.isFinite(endYear) && endYear >= startYear) {
      return unique(Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i));
    }
    return getDefaultYears();
  }

  async function readJsonResponse(res) {
    let json = null;
    try {
      json = await res.json();
    } catch (_) {
      json = null;
    }
    return json;
  }

  async function fetchTestsPageForYear(year, pageNumber, pageSize) {
    const res = await loginProxyFetch(API_ENDPOINTS.tests, {
      method: 'POST',
      headers: authHeaders(API_CONFIG.token),
      body: JSON.stringify({
        searchKey: '',
        pageNumber,
        pageSize,
        id: 0,
        academicYear: String(year)
      })
    });

    if (!res.ok) {
      throw new Error(`GetTests failed for ${year}, page ${pageNumber}: HTTP ${res.status}`);
    }

    const json = await readJsonResponse(res);
    return {
      raw: json,
      tests: Array.isArray(json?.data?.result) ? json.data.result : [],
      total: Number(json?.data?.totalRecord ?? 0)
    };
  }

  async function fetchAllTestsForYear(year, pageSize) {
    const first = await fetchTestsPageForYear(year, 1, pageSize);
    const tests = [...first.tests];
    const total = first.total || tests.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));

    for (let page = 2; page <= pageCount; page += 1) {
      const next = await fetchTestsPageForYear(year, page, pageSize);
      tests.push(...next.tests);
      console.log(`[test-scraper] ${year}: loaded page ${page}/${pageCount}`);
    }

    return { year, total, tests };
  }

  async function fetchAppeared(testId) {
    if (!testId) return null;
    if (typeof fetchAppearedResult === 'function') {
      return fetchAppearedResult(API_CONFIG.token, testId);
    }

    const res = await loginProxyFetch(API_ENDPOINTS.appearedResult, {
      method: 'POST',
      headers: authHeaders(API_CONFIG.token),
      body: JSON.stringify({ id: testId, pageNumber: 1, pageSize: 10 })
    });
    if (!res.ok) return null;
    const json = await readJsonResponse(res);
    return json?.data?.result?.[0] || null;
  }

  async function fetchAnalysis(examId) {
    if (!examId) return null;
    if (typeof fetchResultAnalysis === 'function') {
      return fetchResultAnalysis(API_CONFIG.token, examId);
    }

    const res = await loginProxyFetch(API_ENDPOINTS.resultAnalysis(examId), {
      headers: authHeaders(API_CONFIG.token)
    });
    if (!res.ok) return null;
    const json = await readJsonResponse(res);
    return json?.data || null;
  }

  async function fetchLeaderboard(testPaperId) {
    if (!testPaperId) return null;
    if (typeof fetchLeaderboardScore === 'function') {
      return fetchLeaderboardScore(API_CONFIG.token, testPaperId);
    }

    const res = await loginProxyFetch(API_ENDPOINTS.leaderboardScore, {
      method: 'POST',
      headers: authHeaders(API_CONFIG.token),
      body: JSON.stringify({ id: Number(testPaperId) || testPaperId })
    });
    if (!res.ok) return null;
    const json = await readJsonResponse(res);
    return json?.data || null;
  }

  function summarizeResult(test, appeared, analysis, leaderboard) {
    const result = analysis?.result || {};
    return {
      testName: analysis?.testName || test?.testName || test?.name || '',
      testId: test?.id ?? null,
      testPaperId: test?.testPaperId ?? analysis?.testPaperId ?? null,
      examId: appeared?.examId ?? null,
      academicYear: test?.academicYear ?? null,
      examDate: test?.examDate || test?.testDate || test?.startDate || null,
      isPublish: Boolean(test?.isPublish),
      totalMarks: result?.totalMarks ?? appeared?.totalMarks ?? null,
      totalSubjectMarks: result?.totalSubjectMarks ?? appeared?.totalSubjectMarks ?? null,
      rank: analysis?.rank ?? appeared?.rank ?? null,
      batchRank: analysis?.batchRank ?? appeared?.batchRank ?? null,
      percentage: result?.percentage ?? appeared?.percentage ?? null,
      subjectWise: Array.isArray(result?.subjectWiseResult)
        ? result.subjectWiseResult
        : (Array.isArray(analysis?.subjectWiseResult) ? analysis.subjectWiseResult : []),
      leaderboard: Array.isArray(leaderboard?.leaderboardScore) ? leaderboard.leaderboardScore : []
    };
  }

  function isValidCleanerTest(name) {
    if (!name) return false;
    const upper = String(name).toUpperCase();
    return upper.includes('INTERNAL TEST') || upper.includes('NATIONAL TEST');
  }

  function findSubjectResult(subjects, subjectName) {
    const needle = String(subjectName || '').toLowerCase();
    return subjects.find(subject => String(subject?.subjectName || subject?.name || '').toLowerCase() === needle) || null;
  }

  function normalizeSubject(subject) {
    if (!subject) return null;
    return {
      score: subject.totalMarks ?? subject.marks ?? subject.score ?? null,
      percentile: subject.percentile ?? null,
      avg: subject.totalAvgMarks ?? subject.totalAvg ?? subject.avg ?? null,
      topper: subject.highestMarks ?? subject.totalHighest ?? subject.topper ?? null
    };
  }

  function cleanScrapedTestsData(rawData) {
    const cleaned = [];

    for (const test of rawData?.tests || []) {
      try {
        if (!isValidCleanerTest(test.testName)) continue;

        const analysis = test.raw?.analysis;
        const result = analysis?.result;
        if (!result) continue;

        const subjects = Array.isArray(result.subjectData)
          ? result.subjectData
          : (Array.isArray(result.subjectWiseResult) ? result.subjectWiseResult : (Array.isArray(test.summary?.subjectWise) ? test.summary.subjectWise : []));

        const physics = findSubjectResult(subjects, 'physics');
        const chemistry = findSubjectResult(subjects, 'chemistry');
        const maths = findSubjectResult(subjects, 'maths');

        const rankValue = analysis?.rank ?? test.summary?.rank ?? null;

        cleaned.push({
          testName: test.testName,
          examDate: test.summary?.examDate || null,
          score: result.totalMarks ?? test.summary?.totalMarks ?? null,
          maxMarks: result.totalSubjectMarks ?? test.summary?.totalSubjectMarks ?? null,
          avg: result.totalAvg ?? null,
          topper: result.totalHighest ?? null,
          rank: rankValue == null ? null : Number(rankValue),
          percentile: analysis?.percentile ?? result.percentile ?? null,
          physics: normalizeSubject(physics),
          chemistry: normalizeSubject(chemistry),
          maths: normalizeSubject(maths)
        });
      } catch (err) {
        console.error('Failed cleaning:', test?.testName, err);
      }
    }

    return cleaned;
  }

  function downloadJson(data, fileName) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function mapWithConcurrency(items, limit, worker) {
    const output = new Array(items.length);
    let index = 0;

    async function run() {
      while (index < items.length) {
        const current = index;
        index += 1;
        output[current] = await worker(items[current], current);
      }
    }

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
    return output;
  }

  async function scrapeAllTestResults(options = {}) {
    assertPortalReady();

    const years = getYearsFromOptions(options);
    const pageSize = Number(options.pageSize || DEFAULT_PAGE_SIZE);
    const concurrency = Math.max(1, Number(options.concurrency || 3));
    const includeLeaderboard = options.includeLeaderboard !== false;
    const includeUnpublished = options.includeUnpublished !== false;
    const download = options.download !== false;

    const startedAt = new Date().toISOString();
    console.log(`[test-scraper] Starting. Years: ${years.join(', ')}`);

    const yearsData = [];
    for (const year of years) {
      const yearData = await fetchAllTestsForYear(year, pageSize);
      console.log(`[test-scraper] ${year}: found ${yearData.tests.length}/${yearData.total || yearData.tests.length} tests`);
      yearsData.push(yearData);
    }

    const seen = new Set();
    const tests = yearsData.flatMap(yearData => yearData.tests.map(test => ({ year: yearData.year, test })))
      .filter(({ year, test }) => {
        const id = `${year}:${test?.id ?? ''}:${test?.testPaperId ?? ''}:${test?.testName ?? ''}`;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });

    const rows = await mapWithConcurrency(tests, concurrency, async ({ year, test }, i) => {
      const testId = test?.id || test?.testPaperId;
      const testName = test?.testName || test?.name || `Test ${testId || i + 1}`;
      const published = Boolean(test?.isPublish);
      console.log(`[test-scraper] ${i + 1}/${tests.length}: ${year} - ${testName}`);

      if (!published) {
        return includeUnpublished ? {
          testName,
          academicYear: year,
          skippedReason: 'Not published. Result APIs were not called to avoid forced-result scraping.',
          summary: summarizeResult({ ...test, academicYear: year }, null, null, null),
          raw: { test, appeared: null, analysis: null, leaderboard: null }
        } : null;
      }

      const appeared = await fetchAppeared(testId);
      const examId = appeared?.examId;
      const analysis = examId ? await fetchAnalysis(examId) : null;
      const leaderboardId = test?.id || test?.testPaperId || analysis?.testPaperId;
      const leaderboard = includeLeaderboard ? await fetchLeaderboard(leaderboardId) : null;

      return {
        testName: analysis?.testName || testName,
        academicYear: year,
        skippedReason: examId ? null : 'Published test, but appeared result did not return examId.',
        summary: summarizeResult({ ...test, academicYear: year }, appeared, analysis, leaderboard),
        raw: { test, appeared, analysis, leaderboard }
      };
    });

    const data = {
      generatedAt: new Date().toISOString(),
      startedAt,
      source: 'ExaminationHall APIs only; unpublished tests are not forced.',
      years,
      totals: {
        tests: rows.filter(Boolean).length,
        published: rows.filter(row => row?.summary?.isPublish).length,
        unpublished: rows.filter(row => row && !row.summary?.isPublish).length
      },
      tests: rows.filter(Boolean)
    };

    if (download) {
      downloadJson(data, `ntsc-tests-${years[0]}-${years[years.length - 1]}.json`);
    }

    console.log('[test-scraper] Done. JSON object returned from scrapeAllTestResults().', data);
    return data;
  }

  window.scrapeAllTestResults = scrapeAllTestResults;
  window.cleanScrapedTestsData = cleanScrapedTestsData;
  window.downloadScrapedTestsJson = downloadJson;
})();
