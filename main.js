/* Renderers */
function activeSubTab(pageId, fallback = 'all') {
    return APP_STATE.activeSubTabs?.[pageId] || fallback;
  }
  
  function searchMatch(...values) {
    const q = String(APP_STATE.globalSearch || '').trim().toLowerCase();
    if (!q) return true;
    return values.some(v => String(v || '').toLowerCase().includes(q));
  }
  
  function renderVirtualList(root, items, rowHeight, renderItem) {
    if (!root) return;
    if (items.length <= 20) {
      root.classList.remove('virtual-list');
      root.innerHTML = items.map(renderItem).join('');
      root.onscroll = null;
      return;
    }
  
    root.classList.add('virtual-list');
    const viewportHeight = Math.max(root.clientHeight || 360, 280);
    const overscan = 6;
    const totalHeight = items.length * rowHeight;
    root.innerHTML = `<div class="virtual-spacer" style="height:${totalHeight}px"></div><div class="virtual-content"></div>`;
    const content = root.querySelector('.virtual-content');
    if (!content) return;
  
    const renderWindow = () => {
      const scrollTop = root.scrollTop || 0;
      const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
      const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
      const end = Math.min(items.length, start + visibleCount);
      const offsetY = start * rowHeight;
      content.style.transform = `translateY(${offsetY}px)`;
      content.innerHTML = items.slice(start, end).map(renderItem).join('');
    };
  
    root.onscroll = renderWindow;
    renderWindow();
  }
  
  function renderTodayClasses(items) {
    const root = document.getElementById('today-classes-list');
    if (!root) return;
    const today = getIstDateKey(); const nowMin = getIstHourMinute();
    const todayItems = items
      .filter(c => normalizeDateKey(c?.classDate) === today && !String(c?.classType || '').includes('Doubt'))
      .filter(c => searchMatch(c.subjects, c.classType, c.startTime, formatTimeLabel(c.startTime)))
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    
    if (!todayItems.length) {
      root.innerHTML = '<div class="empty">No classes today</div>';
      return;
    }
    
    root.innerHTML = todayItems.map(c => {
      const done = timeToMinutes(c.startTime) < nowMin;
      return `<div class="class-item"><div class="class-time">${escapeHtml(formatTimeLabel(c.startTime))}</div><div class="class-info"><div class="class-name">${escapeHtml(c.subjects || 'Class')}</div><div class="class-teacher">${escapeHtml(c.classType || 'Live Class')}</div></div><button class="${done ? 'class-btn gray' : 'class-btn'}">${done ? 'Done' : 'Join'}</button></div>`;
    }).join('');
  }
  
  function renderTimetable(items) {
    const grid = document.getElementById('timetable-grid');
    const range = document.getElementById('timetable-range');
    if (!grid) return;
    const clean = items
      .filter(c => !String(c?.classType || '').includes('Doubt'))
      .filter(c => searchMatch(c.subjects, c.classType, c.classDate, c.startTime))
      .map(c => ({ ...c, classDateKey: normalizeDateKey(c.classDate) }))
      .filter(c => c.classDateKey);
    if (!clean.length) {
      grid.classList.remove('tt-grid');
      grid.innerHTML = '<div class="empty">No timetable classes found</div>';
      if (range) range.textContent = 'No week data';
      return;
    }
    const dates = [...new Set(clean.map(c => c.classDateKey))].sort().slice(0, 7);
    if (range) range.textContent = `${formatDateLabel(dates[0])} - ${formatDateLabel(dates[dates.length - 1])}`;
    
    grid.classList.remove('tt-grid');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(220px, 1fr))';
    grid.style.gap = '10px';
    grid.style.background = 'transparent';
    grid.style.minWidth = 'unset';
    
    grid.innerHTML = dates.map(dateKey => {
      const dayItems = clean.filter(c => c.classDateKey === dateKey).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      const dayLabel = new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
      const rows = dayItems.length
        ? dayItems.map(c => `<div style="padding:8px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;margin-top:8px"><div style="font-size:11px;color:var(--text3);margin-bottom:4px">${escapeHtml(formatTimeLabel(c.startTime))}</div><div class="tt-class ${getSubjectClass(c.subjects)}">${escapeHtml(c.subjects || 'Class')}</div><div style="font-size:11px;color:var(--text3);margin-top:5px">${escapeHtml(c.classType || 'Live Class')}</div></div>`).join('')
        : '<div style="font-size:11px;color:var(--text3);margin-top:8px">No classes</div>';
      return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px"><div style="font-size:12px;font-weight:600;color:var(--text2)">${escapeHtml(dayLabel)}</div>${rows}</div>`;
    }).join('');
  }
  
  function renderMessageGroups(groups) {
    const list = document.getElementById('msg-group-list');
    const countEl = document.getElementById('msg-unread-count');
  
    if (!list) return;
  
    const tab = activeSubTab('messages', 'all');
    const filtered = groups.filter(g => {
      if (tab === 'unread' && !(g.unreadCount > 0)) return false;
      return searchMatch(g.title, g.lastMessageTime, g.lastMessageText);
    });
  
    if (!filtered.length) {
      list.innerHTML = '<div class="empty">No messages found</div>';
      if (countEl) countEl.textContent = '0 unread';
      return;
    }
  
    const totalUnread = filtered.reduce((acc, g) => acc + (g.unreadCount || 0), 0);
    if (countEl) countEl.textContent = `${totalUnread} unread`;
  
    list.innerHTML = filtered.map(g => {
      const isUnread = g.unreadCount > 0;
      const fallback = escapeHtml((g.title || 'M')[0].toUpperCase());
      const iconHtml = g.iconUrl 
        ? `<img src="${escapeHtml(g.iconUrl)}" class="msg-group-icon" onerror="this.outerHTML='<div class=\\'msg-group-icon-fallback\\'>${fallback}</div>'"/>` 
        : `<div class="msg-group-icon-fallback">${fallback}</div>`;
  
      return `
        <div class="msg-group-item ${isUnread ? 'unread' : ''} ${currentGroupId === g.groupId ? 'active' : ''}" onclick="selectMessageGroup('${g.groupId}', '${escapeHtml(g.title)}')">
          ${iconHtml}
          <div style="flex:1; min-width:0;">
            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:2px;">
              <div style="font-size:13px; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(g.title || 'Group')}</div>
              <div style="font-size:11px; color:var(--text3); flex-shrink:0; margin-left:8px;">${escapeHtml(g.lastMessageTime || '')}</div>
            </div>
            <div style="font-size:12px; color:var(--text2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${isUnread ? `<span style="color:var(--accent);font-weight:600">${g.unreadCount} new messages</span>` : 'Click to view thread'}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
  
  function renderExamHall(tests) {
    const root = document.getElementById('examhall-list');
    const count = document.getElementById('examhall-count');
    if (!root) return;
    const tab = activeSubTab('examhall', 'all');
    const filtered = tests.filter(t => {
      const published = Boolean(t.isPublish);
      const dt = new Date(t.examDate);
      const now = new Date();
      const status = Number.isNaN(dt.getTime()) ? (published ? 'done' : 'upcoming') : (published ? 'done' : (dt.toDateString() === now.toDateString() ? 'live' : (dt > now ? 'upcoming' : 'live')));
      if (tab === 'published' && !published) return false;
      if (tab === 'pending' && published) return false;
      if (tab === 'live' && status !== 'live') return false;
      return searchMatch(t.testName, t.examType, t.testType, t.id, t.testPaperId);
    });
  
    if (!filtered.length) {
      root.innerHTML = '<div class="empty">No exam hall tests found</div>';
      if (count) count.textContent = '0 active tests';
      return;
    }
    
    const getExamStatus = (test) => {
      const dt = new Date(test.examDate);
      if (Number.isNaN(dt.getTime())) return test.isPublish ? 'done' : 'upcoming';
      if (test.isPublish) return 'done';
      const now = new Date();
      if (dt.toDateString() === now.toDateString()) return 'live';
      return dt > now ? 'upcoming' : 'live';
    };
  
    const active = filtered.filter(t => getExamStatus(t) !== 'done').length;
    if (count) count.textContent = `${active} active test${active === 1 ? '' : 's'}`;
    
    root.innerHTML = filtered.map((test, i) => {
      const status = getExamStatus(test);
      const isDone = status === 'done';
      const appeared = test.appeared || {};
      const testId = String(test.id || test.testPaperId || '');
      const published = Boolean(test.isPublish);
      const date = formatDateLabel(test.examDate || test.testDate || test.startDate);
      const score = (appeared.totalMarks != null && appeared.totalSubjectMarks != null) ? `${appeared.totalMarks}/${appeared.totalSubjectMarks}` : (published ? 'Published' : status === 'live' ? 'Live' : 'Scheduled');
      const rank = appeared.rank != null ? `Rank #${appeared.rank}` : (test.examType || test.testType || '');
      const statusText = published ? 'Published' : (status === 'live' ? 'Live / Not Published' : 'Not Published');
      const statusColor = published ? 'var(--green)' : (status === 'live' ? 'var(--red)' : 'var(--amber)');
      const buttonHtml = isDone && testId
        ? `<button class="start-btn gray" onclick="openExamResult('${escapeHtml(testId)}')">View Result</button>`
        : `<button class="start-btn gray" disabled>${test.isPublish ? 'No Test Id' : 'Not Published'}</button>`;
      
      return `<div class="exam-hall-item" style="${status === 'live' ? 'border-color:var(--red);background:rgba(239,68,68,0.05)' : ''}">
        <div class="exam-hall-icon" style="background:${published ? 'rgba(34,197,94,0.12)' : (status === 'live' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)')};color:${statusColor}">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 15V5h12v10H4z"/><path d="M7 8h6M7 11h4"/></svg>
        </div>
        <div class="exam-hall-info">
          <div class="exam-hall-name">${i}. ${escapeHtml(test.testName || 'Exam')}</div>
          <div class="exam-hall-meta">${escapeHtml(date)} - <span style="color:${statusColor}">${statusText}</span> - ID ${escapeHtml(testId || 'N/A')}</div>
          ${buttonHtml}
        </div>
        <div class="exam-hall-right">
          <div class="exam-hall-score" style="color:${statusColor}">${escapeHtml(score)}</div>
          <div class="exam-hall-rank">${escapeHtml(rank)}</div>
        </div>
      </div>`;
    }).join('');
    updateExamLoadMoreButton();
  }
  
  function renderEraTests(tests) {
    const root = document.getElementById('era-list');
    const count = document.getElementById('era-count');
    if (!root) return;
    const tab = activeSubTab('era', 'all');
    const filtered = tests.filter(t => {
      const published = Boolean(t.isPublish);
      if (tab === 'published' && !published) return false;
      if (tab === 'pending' && published) return false;
      return searchMatch(t.testName, t.name, t.id, t.testPaperId, t.examType, t.testType);
    });
  
    if (!filtered.length) {
      root.innerHTML = '<div class="empty">No tests found</div>';
      if (count) count.textContent = '0 tests';
      return;
    }
  
    if (count) count.textContent = `${filtered.length} test${filtered.length === 1 ? '' : 's'}`;
  
    root.innerHTML = filtered.map((test, i) => {
      const testId = String(test.id || test.testPaperId || '');
      const published = Boolean(test.isPublish);
      const date = formatDateLabel(test.examDate || test.testDate || test.startDate);
      const statusText = published ? 'Published' : 'Not Published';
      const statusColor = published ? 'var(--green)' : 'var(--amber)';
      const forceButton = testId
        ? `<button class="start-btn gray" onclick="openEraForcedResult('${escapeHtml(testId)}')">Force Result</button>`
        : '<button class="start-btn gray" disabled>No Test Id</button>';
  
      return `<div class="exam-hall-item">
        <div class="exam-hall-icon" style="background:${published ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.15)'};color:${statusColor}">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 15V5h12v10H4z"/><path d="M7 8h6M7 11h4"/></svg>
        </div>
        <div class="exam-hall-info">
          <div class="exam-hall-name">${i}. ${escapeHtml(test.testName || test.name || 'Exam')}</div>
          <div class="exam-hall-meta">${escapeHtml(date)} - <span style="color:${statusColor}">${statusText}</span> - ID ${escapeHtml(testId || 'N/A')}</div>
          ${forceButton}
        </div>
        <div class="exam-hall-right">
          <div class="exam-hall-score" style="color:${statusColor}">${published ? 'Open' : 'Forced'}</div>
          <div class="exam-hall-rank">${escapeHtml(test.examType || test.testType || '')}</div>
        </div>
      </div>`;
    }).join('');
    updateEraLoadMoreButton();
  }
  
  function updateExamLoadMoreButton() {
    const btn = document.getElementById('examhall-load-more');
    if (!btn) return;
    const total = APP_STATE.examTotal || APP_STATE.tests.length;
    const hasMore = APP_STATE.tests.length < total;
    btn.style.display = hasMore ? 'block' : 'none';
    btn.textContent = hasMore ? `Show More (${APP_STATE.tests.length}/${total})` : 'All tests loaded';
  }
  
  function updateEraLoadMoreButton() {
    const btn = document.getElementById('era-load-more');
    if (!btn) return;
    const total = APP_STATE.eraTotal || APP_STATE.eraTests.length;
    const hasMore = APP_STATE.eraTests.length < total;
    btn.style.display = hasMore ? 'block' : 'none';
    btn.textContent = hasMore ? `Show More (${APP_STATE.eraTests.length}/${total})` : 'All tests loaded';
  }
  
  function renderExamCalendar(entries) {
    const root = document.getElementById('examcal-list');
    const title = document.getElementById('examcal-title');
    if (!root) return;
    if (!entries.length) {
      root.innerHTML = '<div class="empty">No exams found</div>';
      if (title) title.textContent = 'Exam Calendar';
      return;
    }
    
    const normalized = entries.map(item => {
      const lines = syllabusToLines(item.syllabus || '');
      return {
        id: item.id,
        name: item.name || item.testName || item.examName || 'Exam',
        dateTime: item.dateTime || item.testDateTime || item.examDate || item.date,
        mode: item.mode || item.testMode || item.examMode || '',
        venue: formatVenueText(item.venue || ''),
        syllabusLines: Array.isArray(item.syllabusLines) && item.syllabusLines.length ? item.syllabusLines : lines,
        syllabusPreview: item.syllabusPreview || lines.slice(0, 2).join(' | ')
      };
    }).filter(item => item.dateTime).filter(item => searchMatch(item.name, item.dateTime, item.mode, item.venue, item.syllabusPreview));
    
    const sorted = normalized.sort((a, b) => parseExamDateTime(b.dateTime) - parseExamDateTime(a.dateTime));
    APP_STATE.calendarEntries = sorted;
    
    const first = sorted.find(t => !Number.isNaN(parseExamDateTime(t.dateTime).getTime()));
    if (title && first) title.textContent = `Exam Calendar - ${parseExamDateTime(first.dateTime).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`;
    
    const now = new Date();
    root.innerHTML = sorted.slice(0, 30).map((item, i) => {
      const dt = parseExamDateTime(item.dateTime);
      const status = Number.isNaN(dt.getTime()) ? 'upcoming' : (dt < now ? 'done' : (dt.toDateString() === now.toDateString() ? 'live' : 'upcoming'));
      const syllabus = item.syllabusPreview ? `${escapeHtml(item.syllabusPreview.slice(0, 160))}${item.syllabusPreview.length > 160 ? '...' : ''}` : '';
      const modeLabel = item.mode ? `${escapeHtml(item.mode)}` : '';
      
      return `<div class="exam-item exam-calendar-item">
        <div class="exam-dot" style="background:${status === 'done' ? 'var(--green)' : (status === 'live' ? 'var(--red)' : 'var(--accent)')};margin-top:6px"></div>
        <div class="exam-info">
          <div class="exam-name">${i + 1}. ${escapeHtml(item.name)}</div>
          <div class="exam-date">${escapeHtml(formatDateTimeLabel(item.dateTime))}</div>
          <div class="exam-calendar-meta">
            ${modeLabel ? `<span class="exam-calendar-chip">${modeLabel}</span>` : ''}
            ${syllabus ? `<span class="exam-calendar-chip subtle">${syllabus}</span>` : ''}
          </div>
        </div>
        <div class="exam-calendar-right">
          <span class="exam-badge ${status === 'done' ? 'badge-done' : (status === 'live' ? 'badge-live' : 'badge-upcoming')}">${status === 'done' ? 'Done' : (status === 'live' ? 'Today' : 'Upcoming')}</span>
          <button class="exam-view-btn" onclick="openCalendarTest(${i})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            View Details
          </button>
        </div>
      </div>`;
    }).join('');
  }
  
  function renderCourses(courses) {
    const grid = document.getElementById('courses-grid');
    const count = document.getElementById('courses-count');
    if (!grid) return;
  
    const tab = activeSubTab('courses', 'all');
    const filtered = courses.filter(c => {
      if (tab === 'live' && !c.isLive) return false;
      if (tab === 'exam' && !c.isExamType) return false;
      if (tab === 'classroom' && (c.isLive || c.isExamType)) return false;
      return searchMatch(c.courseName, c.goal, c.startDate, c.expireyDate);
    });
  
    if (count) count.textContent = `${filtered.length} course${filtered.length === 1 ? '' : 's'}`;
    if (!filtered.length) {
      grid.innerHTML = '<div class="empty">No courses found</div>';
      return;
    }
  
    const colors = ['var(--accent)', 'var(--purple)', 'var(--green)', 'var(--amber)'];
    grid.innerHTML = filtered.map((c, i) => {
      const tone = colors[i % colors.length];
      const start = formatDateLabel(c.startDate);
      const expiry = formatDateLabel(c.expireyDate);
      const badgeBg = tone === 'var(--amber)' ? 'rgba(245,158,11,0.15)' : tone === 'var(--green)' ? 'rgba(34,197,94,0.12)' : tone === 'var(--purple)' ? 'rgba(167,139,250,0.15)' : 'rgba(61,127,255,0.15)';
      const image = c.image || c.courseImage || '';
      const cid = Number(c.courseId ?? c.id ?? c.courseID ?? 0);
      const typeLabel = c.isLive ? 'Live now' : (c.isExamType ? 'Exam course' : 'Classroom');
      const imgBlock = image ? `<div class="course-image"><img src="${escapeHtml(image)}" alt="${escapeHtml(c.courseName || 'Course')}"/></div>` : '';
      
      return `
        <div class="course-card ${image ? 'has-image' : 'no-image'}" style="--course-tone:${tone}">
          ${imgBlock}
          <div class="course-head">
            <span class="course-badge" style="background:${badgeBg};color:${tone}">${escapeHtml(c.goal || 'Course')}</span>
            <span class="course-type">${escapeHtml(typeLabel)}</span>
          </div>
          <div class="course-name">${escapeHtml(c.courseName || 'Untitled Course')}</div>
          <div class="course-meta">
            <span><b>Start</b> ${escapeHtml(start)}</span>
            <span><b>Expiry</b> ${escapeHtml(expiry)}</span>
          </div>
          <div class="course-prog-bar"><div class="course-prog-fill" style="width:${c.isLive ? '100%' : '72%'};background:${tone}"></div></div>
          <div class="course-bottom">
            <div class="course-pct">${escapeHtml(typeLabel)}</div>
            <button class="course-btn" onclick="openCourseDetail(${cid})" ${cid ? '' : 'disabled'}>${c.isLive ? 'Join' : 'Open'}</button>
          </div>
        </div>
      `;
    }).join('');
  }
  
  function renderNotices(notices) {
    const list = document.getElementById('notice-list');
    const countEl = document.getElementById('notice-count');
    if (!list) return;
    const tab = activeSubTab('notices', 'all');
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const filtered = notices.filter(n => {
      const createdMs = new Date(n.createdDate || '').getTime();
      if (tab === 'test' && !n.testDate) return false;
      if (tab === 'recent' && (!(createdMs > 0) || (now - createdMs) > sevenDays)) return false;
      return searchMatch(n.title, n.createdDate, n.testDate);
    });
  
    if (!filtered.length) {
      list.innerHTML = '<div class="empty">No notices found</div>';
      if (countEl) countEl.textContent = '0 notices';
      return;
    }
    if (countEl) countEl.textContent = `${filtered.length} notice${filtered.length === 1 ? '' : 's'}`;
    const noticeRenderer = (n) => {
      const testDateHtml = n.testDate ? ` · Test Date: ${escapeHtml(n.testDate)}` : '';
      return `<div class="notice-item" style="display:flex; justify-content:space-between; align-items:center;"><div style="flex:1; min-width:0; padding-right:12px;"><div class="notice-title" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(n.title || 'Untitled Notice')}</div><div class="notice-time">Created: ${escapeHtml(n.createdDate || 'Unknown')}${testDateHtml}</div></div><button class="start-btn gray" style="margin:0; flex-shrink:0" onclick="openNoticeFile('${n.id}')">View</button></div>`;
    };
  
    renderVirtualList(list, filtered, 72, noticeRenderer);
  }
  
  function renderStudyContent(materials, totalCount = 0) {
    const root = document.getElementById('study-list');
    const count = document.getElementById('study-count');
    const btn = document.getElementById('study-load-more');
    if (!root) return;
    
    const tab = activeSubTab('study', 'all');
    const filtered = materials.filter(m => {
      const subj = String(m.subjectName || '').toLowerCase();
      if (tab === 'physics' && !subj.includes('phy')) return false;
      if (tab === 'chemistry' && !subj.includes('chem')) return false;
      if (tab === 'math' && !subj.includes('math')) return false;
      return searchMatch(m.title, m.subjectName, m.createdDate);
    });
  
    if (!filtered.length) {
      root.innerHTML = '<div class="empty">No study content found</div>';
      if (count) count.textContent = '0 items';
      if (btn) btn.style.display = 'none';
      return;
    }
    
    if (count) count.textContent = `${filtered.length} shown${totalCount ? ` / ${totalCount}` : ''}`;
    
    const studyRenderer = (m) => {
      let subjectColor = 'var(--accent)';
      const subj = String(m.subjectName || '').toLowerCase();
      if(subj.includes('chem')) subjectColor = 'var(--purple)';
      if(subj.includes('math')) subjectColor = 'var(--green)';
  
      return `
        <div class="exam-hall-item" style="padding:10px 14px">
          <div class="exam-hall-icon" style="background:var(--bg4); width:36px; height:36px; color:var(--text2)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </div>
          <div class="exam-hall-info">
            <div class="exam-hall-name" style="font-size:13px">${escapeHtml(m.title || 'Document')}</div>
            <div class="exam-hall-meta">
              ${escapeHtml(m.createdDate || 'Unknown date')} · 
              <span style="color:${subjectColor}; font-weight:600">${escapeHtml(m.subjectName || 'General')}</span>
            </div>
          </div>
          <div class="exam-hall-right">
            <button class="start-btn gray" style="margin-top:0" onclick="openStudyFile('${m.id}')">View</button>
          </div>
        </div>
      `;
    };
    
    renderVirtualList(root, filtered, 82, studyRenderer);
    
    if(btn) {
      btn.style.display = materials.length < (totalCount || 0) ? 'block' : 'none';
    }
  }
  
  function ensureAttendanceModal() {
    if (document.getElementById('att-modal-backdrop')) return;
    const wrapper = document.createElement('div');
    wrapper.id = 'att-modal-backdrop';
    wrapper.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:none;align-items:center;justify-content:center;z-index:5000;padding:16px';
    wrapper.innerHTML = `
      <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:12px;max-width:400px;width:100%;max-height:80vh;display:flex;flex-direction:column">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border)">
          <div style="font-size:14px;font-weight:600;color:var(--text)">Attendance Report</div>
          <button onclick="document.getElementById('att-modal-backdrop').style.display='none'" style="background:var(--bg3);color:var(--text2);border:1px solid var(--border);border-radius:8px;padding:5px 10px;cursor:pointer">Close</button>
        </div>
        <div style="padding:16px;border-bottom:1px solid var(--border);display:flex;gap:10px">
          <select id="att-month" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);padding:6px;border-radius:6px;flex:1"></select>
          <select id="att-year" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);padding:6px;border-radius:6px;flex:1"></select>
          <button onclick="renderAttendanceModal()" class="start-btn" style="margin:0">View</button>
        </div>
        <div id="att-modal-body" style="padding:16px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:8px"></div>
      </div>`;
    document.body.appendChild(wrapper);
  }
  
  function ensureResultModal() {
    if (document.getElementById('result-modal-backdrop')) return;
    const wrapper = document.createElement('div');
    wrapper.id = 'result-modal-backdrop';
    wrapper.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:none;align-items:center;justify-content:center;z-index:5000;padding:16px';
    wrapper.innerHTML = '<div class="result-modal-card"><div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border)"><div style="font-size:14px;font-weight:600;color:var(--text)">Result Analysis</div><button onclick="closeResultModal()" style="background:var(--bg3);color:var(--text2);border:1px solid var(--border);border-radius:8px;padding:5px 10px;cursor:pointer">Close</button></div><div id="result-modal-body" style="padding:16px"></div></div>';
    wrapper.addEventListener('click', (e) => { if (e.target === wrapper) closeResultModal(); });
    document.body.appendChild(wrapper);
  }
  
  function closeResultModal() {
    const el = document.getElementById('result-modal-backdrop');
    if (el) el.style.display = 'none';
  }
  
  function showResultModal(contentHtml) {
    ensureResultModal();
    const backdrop = document.getElementById('result-modal-backdrop');
    const body = document.getElementById('result-modal-body');
    if (!backdrop || !body) return;
    body.innerHTML = contentHtml;
    backdrop.style.display = 'flex';
  }
  
  function buildResultAnalysisHtml(analysis, selected, options = {}) {
    const r = analysis?.result || {};
    const testName = analysis?.testName || selected?.testName || selected?.name || 'Exam';
    const fmt = v => (v === null || v === undefined || v === '') ? '-' : v;
    const topTotal = Array.isArray(r.topScoreTotal) && r.topScoreTotal.length ? r.topScoreTotal.join(', ') : '-';
    const performanceMap = new Map((analysis?.subjectPerformance || []).map(p => [String(p.subjectName || '').toLowerCase(), p.performance]));
    const topBySubject = {};
    if (Array.isArray(r.topScoreSubjectData)) {
      r.topScoreSubjectData.forEach(item => {
        const key = String(item.subjectId ?? '');
        if (!topBySubject[key]) topBySubject[key] = [];
        topBySubject[key].push(item.totalMarks);
      });
    }
  
    const subjectRows = Array.isArray(r.subjectData) ? r.subjectData.map(s => {
      const correct = Number(s.totalCorrect ?? 0);
      const incorrect = Number(s.totalInCorrect ?? s.totalIncorrect ?? 0);
      const unattempted = Number(s.totalUnAttempted ?? s.totalUnattempted ?? 0);
      const attempted = Number(s.totalAttempted ?? (correct + incorrect));
      const subjectTopScores = topBySubject[String(s.subjectId ?? '')]?.join(', ') || '-';
      const performance = performanceMap.get(String(s.subjectName || '').toLowerCase()) || '-';
      return `<div class="subject-result-card">
        <div class="subject-result-head">
          <div>
            <div class="subject-result-name">${escapeHtml(s.subjectName || 'Subject')}</div>
            <div class="result-sub">Performance ${escapeHtml(performance)} | Rank ${escapeHtml(fmt(s.rank))} | Percentile ${escapeHtml(fmt(s.percentile))}</div>
          </div>
          <div class="subject-result-score">${escapeHtml(fmt(s.totalMarks))}/${escapeHtml(fmt(s.totalSubjectMarks))}</div>
        </div>
        <div class="subject-highlight-grid">
          <div class="mini-metric major"><div class="mini-label">Your Marks</div><div class="mini-value">${escapeHtml(fmt(s.totalMarks))}/${escapeHtml(fmt(s.totalSubjectMarks))}</div></div>
          <div class="mini-metric major"><div class="mini-label">Average</div><div class="mini-value">${escapeHtml(fmt(s.totalAvgMarks))}</div></div>
          <div class="mini-metric major"><div class="mini-label">Highest</div><div class="mini-value">${escapeHtml(fmt(s.highestMarks))}</div></div>
        </div>
        <div class="subject-result-grid">
          <div class="mini-metric"><div class="mini-label">Attempted</div><div class="mini-value">${escapeHtml(attempted)}</div></div>
          <div class="mini-metric"><div class="mini-label">Correct</div><div class="mini-value">${escapeHtml(correct)}</div></div>
          <div class="mini-metric"><div class="mini-label">Wrong</div><div class="mini-value">${escapeHtml(incorrect)}</div></div>
          <div class="mini-metric"><div class="mini-label">Unattempted</div><div class="mini-value">${escapeHtml(unattempted)}</div></div>
          <div class="mini-metric"><div class="mini-label">Questions</div><div class="mini-value">${escapeHtml(fmt(s.totalQuestion))}</div></div>
          <div class="mini-metric"><div class="mini-label">Not Visited</div><div class="mini-value">${escapeHtml(fmt(s.totalNotVisited))}</div></div>
          <div class="mini-metric"><div class="mini-label">Top Scores</div><div class="mini-value">${escapeHtml(subjectTopScores)}</div></div>
        </div>
      </div>`;
    }).join('') : '<div class="empty">No subject breakdown</div>';
  
    const appearedRaw = options.includeRaw && options.appeared ? `<details style="margin-top:12px"><summary style="font-size:12px;color:var(--accent);cursor:pointer">Appeared result raw data</summary><pre style="margin-top:8px;background:#05070b;border:1px solid var(--border);border-radius:8px;padding:10px;white-space:pre-wrap;overflow:auto;font-size:11px;color:var(--text2)">${escapeHtml(JSON.stringify(options.appeared, null, 2))}</pre></details>` : '';
    const analysisRaw = options.includeRaw ? `<details style="margin-top:10px"><summary style="font-size:12px;color:var(--accent);cursor:pointer">Analysis raw data</summary><pre style="margin-top:8px;background:#05070b;border:1px solid var(--border);border-radius:8px;padding:10px;white-space:pre-wrap;overflow:auto;font-size:11px;color:var(--text2)">${escapeHtml(JSON.stringify(analysis, null, 2))}</pre></details>` : '';
    const omrRow = analysis?.omrSheetPath ? `<a class="result-link" href="${escapeHtml(analysis.omrSheetPath)}" target="_blank" rel="noopener noreferrer">OMR Sheet</a>` : '';
    const answerKeyRow = analysis?.answerKeyFileUrl ? `<a class="result-link" href="${escapeHtml(analysis.answerKeyFileUrl)}" target="_blank" rel="noopener noreferrer">Answer Key</a>` : '';
    const leaderboardButton = (options.showLeaderboardButton || options.leaderboard)
      ? `<button class="start-btn gray" style="margin-top:0" onclick="openCurrentLeaderboard()">Leaderboard</button>`
      : '';
    const forcedNotice = options.forced ? `<div style="margin-bottom:10px;padding:8px 10px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.28);border-radius:8px;color:var(--amber);font-size:12px">Forced result mode used: publish status was ignored and result analysis was fetched through examId.</div>` : '';
    const flags = [
      analysis?.isLiveTest ? 'Live test' : 'Offline result',
      analysis?.isLeaderboard ? 'Leaderboard' : '',
      analysis?.isShowScoreSheet ? 'Score sheet' : '',
      analysis?.isShowQuestionsCount ? 'Question counts' : '',
      analysis?.isShowComparisonTestScore ? 'Comparison score' : '',
      analysis?.isShowCandidateTopScore ? 'Top scores' : ''
    ].filter(Boolean).map(label => `<span class="result-chip">${escapeHtml(label)}</span>`).join('');
  
    return `${forcedNotice}<div class="result-title">${escapeHtml(testName)}</div>
      <div class="result-sub">${escapeHtml(analysis?.attemptDate || '')}${analysis?.testPaperId ? ` | Paper ${escapeHtml(analysis.testPaperId)}` : ''}</div>
      <div class="result-chip-row">${flags}</div>
      <div class="result-hero">
        <div class="result-hero-score">
          <div class="result-hero-label">Your Score</div>
          <div class="result-hero-value">${escapeHtml(fmt(r.totalMarks))}/${escapeHtml(fmt(r.totalSubjectMarks))}</div>
          <div class="result-hero-sub">Average ${escapeHtml(fmt(r.totalAvg))} | Highest ${escapeHtml(fmt(r.totalHighest))}</div>
        </div>
        <div class="result-hero-stat"><div class="result-label">Rank</div><div class="result-value">${escapeHtml(fmt(analysis?.rank))}</div></div>
        <div class="result-hero-stat"><div class="result-label">Batch Rank</div><div class="result-value">${escapeHtml(fmt(analysis?.batchRank))}</div></div>
        <div class="result-hero-stat"><div class="result-label">Percentile</div><div class="result-value">${escapeHtml(fmt(analysis?.percentile))}</div></div>
      </div>
      <div class="result-grid">
        <div class="result-metric"><div class="result-label">Attempted</div><div class="result-value">${escapeHtml(fmt(r.totalAttempted))}</div></div>
        <div class="result-metric"><div class="result-label">Correct</div><div class="result-value" style="color:var(--green)">${escapeHtml(fmt(r.totalCorrect))}</div></div>
        <div class="result-metric"><div class="result-label">Wrong</div><div class="result-value" style="color:var(--red)">${escapeHtml(fmt(r.totalInCorrect ?? r.totalIncorrect))}</div></div>
        <div class="result-metric"><div class="result-label">Unattempted</div><div class="result-value">${escapeHtml(fmt(r.totalUnAttempted ?? r.totalUnattempted))}</div></div>
        <div class="result-metric"><div class="result-label">Average</div><div class="result-value">${escapeHtml(fmt(r.totalAvg))}</div></div>
        <div class="result-metric"><div class="result-label">Highest</div><div class="result-value">${escapeHtml(fmt(r.totalHighest))}</div></div>
        <div class="result-metric"><div class="result-label">Top Scores</div><div class="result-value">${escapeHtml(topTotal)}</div></div>
        <div class="result-metric"><div class="result-label">Students</div><div class="result-value">${escapeHtml(fmt(analysis?.totalStudent))}</div></div>
        <div class="result-metric"><div class="result-label">City Rank</div><div class="result-value">${escapeHtml(fmt(analysis?.cityRank))}</div></div>
      </div>
      <div class="result-section-title">Subject Breakdown</div>${subjectRows}
      <div class="result-links">${leaderboardButton}${omrRow}${answerKeyRow}</div>${appearedRaw}${analysisRaw}`;
  }
  
  function buildLeaderboardHtml(analysis, leaderboard) {
    const rows = Array.isArray(leaderboard?.leaderboardScore) ? leaderboard.leaderboardScore.slice(0, 50) : [];
    if (!rows.length) return '<div class="empty">No leaderboard data found for this test.</div>';
  
    const subjectNameById = {};
    const subjects = analysis?.result?.subjectData || [];
    if (Array.isArray(subjects)) {
      subjects.forEach(s => {
        if (s.subjectId != null) subjectNameById[String(s.subjectId)] = s.subjectName || `Subject ${s.subjectId}`;
      });
    }
  
    const fmt = v => (v === null || v === undefined || v === '') ? '-' : v;
    const rowData = rows.map(row => {
      const subjectMarks = Array.isArray(row.subjectPerformance) ? row.subjectPerformance.map((s, idx) => {
        const subjectName = s.subjectName || subjectNameById[String(s.subjectId ?? '')] || `S${idx + 1}`;
        return { subjectName, totalMarks: fmt(s.totalMarks) };
      }) : [];
      return { ...row, subjectMarks };
    });
  
    return `<div class="leaderboard-wrap"><table class="leaderboard-table">
      <thead><tr><th>Rank</th><th>Student</th><th>Total</th><th>Subject Marks</th></tr></thead>
      <tbody>${rowData.map(row => {
        const subjectMarks = row.subjectMarks.map(s => `<span class="leaderboard-subject">${escapeHtml(s.subjectName)}: ${escapeHtml(s.totalMarks)}</span>`).join('');
        return `<tr>
          <td class="leaderboard-rank">#${escapeHtml(fmt(row.ranks))}</td>
          <td>${escapeHtml(row.studentName || `Student ${fmt(row.examId)}`)}</td>
          <td class="leaderboard-score">${escapeHtml(fmt(row.totalMarks))}</td>
          <td><div class="leaderboard-subjects">${subjectMarks || '-'}</div></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
    <div class="leaderboard-card-list">${rowData.map(row => {
      const subjectMarks = row.subjectMarks.map(s => `<span class="leaderboard-subject">${escapeHtml(s.subjectName)}: ${escapeHtml(s.totalMarks)}</span>`).join('');
      return `<div class="leaderboard-card">
        <div class="leaderboard-card-top">
          <div style="display:flex;align-items:center;gap:10px;min-width:0">
            <div class="leaderboard-rank-pill">#${escapeHtml(fmt(row.ranks))}</div>
            <div style="font-size:12px;color:var(--text);font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis">${escapeHtml(row.studentName || `Student ${fmt(row.examId)}`)}</div>
          </div>
          <div class="leaderboard-card-score"><span class="leaderboard-score">${escapeHtml(fmt(row.totalMarks))}</span><span style="font-size:10px;color:var(--text3)">marks</span></div>
        </div>
        <div class="leaderboard-subjects">${subjectMarks || '-'}</div>
      </div>`;
    }).join('')}</div>`;
  }
  
  function renderApiError(message) {
    const els = ['timetable-grid', 'examhall-list', 'era-list', 'today-classes-list', 'examcal-list', 'courses-grid', 'msg-group-list', 'notice-list', 'study-list'];
    els.forEach(id => {
      const el = document.getElementById(id);
      if(el) el.innerHTML = `<div class="empty">${escapeHtml(message)}</div>`;
    });
  }
  
  function updateDashboardWidgets() {
    const nameEl = document.getElementById('dash-test-name');
    const scoreEl = document.getElementById('dash-test-score');
    const subEl = document.getElementById('dash-test-sub');
    const batchRankEl = document.getElementById('dash-batch-rank');
    const batchRankSubEl = document.getElementById('dash-rank-sub');
    
    if (nameEl && scoreEl && subEl) {
      const forced = APP_STATE.dashboardForcedStats || null;
      if (!forced) {
        scoreEl.textContent = 'N/A';
        subEl.innerHTML = 'No forced-result data yet';
        if (batchRankEl) batchRankEl.textContent = '--';
        if (batchRankSubEl) batchRankSubEl.textContent = 'No ERA rank available';
      } else {
        const rankVal = forced.batchRank ?? forced.rank ?? null;
        nameEl.textContent = forced.testName || 'Latest Test';
        scoreEl.textContent = forced.marks ?? 'N/A';
        let subHtml = `out of ${forced.totalMarks ?? '-'}`;
        if (rankVal != null) subHtml += ` · Rank #${rankVal}`;
        subEl.innerHTML = subHtml;
        if (batchRankEl) batchRankEl.textContent = rankVal != null ? `#${rankVal}` : '--';
        if (batchRankSubEl) batchRankSubEl.textContent = forced.testName ? `ERA: ${forced.testName}` : 'ERA forced result stats';
      }
    }
  
    const upListEl = document.getElementById('dashboard-upcoming-list');
    if (upListEl) {
      const now = new Date();
      const upcomingList = APP_STATE.calendarEntries.filter(t => {
        const dt = parseExamDateTime(t.dateTime);
        return !Number.isNaN(dt.getTime()) && dt > new Date(now.getTime() - 86400000); 
      }).sort((a,b) => parseExamDateTime(a.dateTime) - parseExamDateTime(b.dateTime));
  
      const filteredUpcoming = upcomingList.filter(item => searchMatch(item.name, item.dateTime, item.venue));
      if (!filteredUpcoming.length) {
        upListEl.innerHTML = '<div class="empty" style="padding:10px 0">No upcoming exams</div>';
      } else {
        upListEl.innerHTML = filteredUpcoming.slice(0, 3).map(item => {
           const dt = parseExamDateTime(item.dateTime);
           const isToday = dt.toDateString() === now.toDateString();
           const dotColor = isToday ? 'var(--red)' : 'var(--accent)';
           return `
              <div class="exam-item" style="cursor:pointer" onclick="openEraFromDashboard('${escapeHtml(item.name)}')">
                <div class="exam-dot" style="background:${dotColor}"></div>
                <div class="exam-info">
                  <div class="exam-name">${escapeHtml(item.name)}</div>
                  <div class="exam-date">${escapeHtml(formatDateTimeLabel(item.dateTime))}</div>
                </div>
                <span class="exam-badge ${isToday ? 'badge-live' : 'badge-upcoming'}">${isToday ? 'Today' : 'Upcoming'}</span>
              </div>`;
        }).join('');
      }
    }
  }
  
  function setUserProfileDetails() {
    const name = sessionStorage.getItem('fy_user_name') || 'Student';
    const imgUrl = sessionStorage.getItem('fy_user_img');
    
    const topAvatar = document.getElementById('top-avatar');
    const sideAvatar = document.getElementById('sidebar-avatar');
    const sideName = document.getElementById('sidebar-name');
    
    const initials = name.slice(0,2).toUpperCase();
    
    if (sideName) sideName.textContent = name;
    
    const updateAvatar = (el) => {
      if(!el) return;
      if(imgUrl) {
        el.innerHTML = `<img src="${escapeHtml(imgUrl)}" alt="Avatar" onerror="this.outerHTML='${initials}'"/>`;
      } else {
        el.textContent = initials;
      }
    };
    
    updateAvatar(topAvatar);
    updateAvatar(sideAvatar);
  }
  
  /* --- NAVIGATION & UI TOGGLES --- */
  const SUBNAV_CONFIG = {
    dashboard: [{ id: 'overview', label: 'Overview' }, { id: 'schedule', label: 'Schedule' }],
    courses: [{ id: 'all', label: 'All' }, { id: 'live', label: 'Live' }, { id: 'exam', label: 'Exam' }, { id: 'classroom', label: 'Classroom' }],
    messages: [{ id: 'all', label: 'All' }, { id: 'unread', label: 'Unread' }],
    examhall: [{ id: 'all', label: 'All' }, { id: 'published', label: 'Published' }, { id: 'pending', label: 'Pending' }, { id: 'live', label: 'Live' }],
    era: [{ id: 'all', label: 'All' }, { id: 'published', label: 'Published' }, { id: 'pending', label: 'Pending' }],
    notices: [{ id: 'all', label: 'All' }, { id: 'recent', label: 'Recent' }, { id: 'test', label: 'Test Alerts' }],
    study: [{ id: 'all', label: 'All' }, { id: 'physics', label: 'Physics' }, { id: 'chemistry', label: 'Chemistry' }, { id: 'math', label: 'Math' }]
  };
  
  const THEME_PRESETS = [
    { id: 'default', label: 'Classic Blue', colors: ['#5f8dff', '#7a6dff', '#172038'] },
    { id: 'ocean', label: 'Ocean', colors: ['#4f9dff', '#20b6ff', '#143a56'] },
    { id: 'purple', label: 'Purple Tint', colors: ['#9b7bff', '#c25dff', '#2a1f45'] },
    { id: 'emerald', label: 'Emerald', colors: ['#22c55e', '#14b8a6', '#163f35'] }
  ];
  
  const COMMANDS = [
    { id: 'go-dashboard', label: 'Go to Dashboard', meta: 'Navigation', run: () => nav('dashboard', document.querySelector('.nav-item[onclick*=dashboard]')) },
    { id: 'go-courses', label: 'Go to My Courses', meta: 'Navigation', run: () => nav('courses', document.querySelector('.nav-item[onclick*=courses]')) },
    { id: 'go-messages', label: 'Go to Messages', meta: 'Navigation', run: () => nav('messages', document.querySelector('.nav-item[onclick*=messages]')) },
    { id: 'go-timetable', label: 'Go to Time Table', meta: 'Navigation', run: () => nav('timetable', document.querySelector('.nav-item[onclick*=timetable]')) },
    { id: 'go-examhall', label: 'Go to Examination Hall', meta: 'Navigation', run: () => nav('examhall', document.querySelector('.nav-item[onclick*=examhall]')) },
    { id: 'go-era', label: 'Go to ERA Forced Results', meta: 'Navigation', run: () => nav('era', document.querySelector('.nav-item[onclick*=era]')) },
    { id: 'go-neural', label: 'Go to Neural Network', meta: 'Navigation', run: () => nav('neural', document.querySelector('.nav-item[onclick*=neural]')) },
    { id: 'go-settings', label: 'Go to Settings', meta: 'Navigation', run: () => nav('settings', document.querySelector('.nav-item[onclick*=settings]')) },
    { id: 'go-notices', label: 'Go to Notice Board', meta: 'Navigation', run: () => nav('notices', document.querySelector('.nav-item[onclick*=notices]')) },
    { id: 'go-study', label: 'Go to Study Content', meta: 'Navigation', run: () => nav('study', document.querySelector('.nav-item[onclick*=study]')) },
    { id: 'go-practice', label: 'Go to Practice', meta: 'Navigation', run: () => nav('practice', document.querySelector('.nav-item[onclick*=practice]')) },
    { id: 'open-attendance', label: 'Open Attendance Modal', meta: 'Action', run: () => openAttendanceModal() },
    { id: 'refresh-now', label: 'Refresh Data Now', meta: 'Sync', run: () => refreshPortalDataInBackground() },
    { id: 'toggle-theme', label: 'Toggle Theme', meta: 'Appearance', run: () => toggleThemeMode() },
    { id: 'logout', label: 'Logout', meta: 'Session', run: () => logout() }
  ];
  
  const PORTAL_CACHE_KEY = 'fy_portal_cache_v2';
  const PORTAL_CACHE_TTL_MS = 15 * 60 * 1000;
  const PORTAL_REFRESH_INTERVAL_MS = 2 * 60 * 1000;
  
  function formatRelativeTime(ts) {
    const deltaSec = Math.max(0, Math.floor((Date.now() - Number(ts || 0)) / 1000));
    if (deltaSec < 10) return 'just now';
    if (deltaSec < 60) return `${deltaSec}s ago`;
    if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m ago`;
    return `${Math.floor(deltaSec / 3600)}h ago`;
  }
  
  function setSyncPill(mode, text) {
    const pill = document.getElementById('sync-pill');
    if (!pill) return;
    pill.classList.remove('cached', 'offline');
    if (mode === 'cached') pill.classList.add('cached');
    if (mode === 'offline') pill.classList.add('offline');
    pill.textContent = text || (mode === 'live' ? 'Live' : mode === 'cached' ? 'Cached' : 'Offline');
  }
  
  function readPortalCache() {
    try {
      const raw = localStorage.getItem(PORTAL_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.snapshotAt || !parsed?.data) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }
  
  function writePortalCache() {
    try {
      const payload = {
        snapshotAt: Date.now(),
        data: {
          tests: APP_STATE.tests || [],
          eraTests: APP_STATE.eraTests || [],
          calendarEntries: APP_STATE.calendarEntries || [],
          timetable: APP_STATE.timetable || [],
          courses: APP_STATE.courses || [],
          messageGroups: APP_STATE.messageGroups || [],
          notices: APP_STATE.notices || [],
          studyContent: APP_STATE.studyContent || [],
          studyTotal: APP_STATE.studyTotal || 0,
          examTotal: APP_STATE.examTotal || 0,
          eraTotal: APP_STATE.eraTotal || 0
        }
      };
      localStorage.setItem(PORTAL_CACHE_KEY, JSON.stringify(payload));
      APP_STATE.lastSyncAt = payload.snapshotAt;
    } catch (_) {}
  }
  
  function hydratePortalCache() {
    const cached = readPortalCache();
    if (!cached) return false;
    APP_STATE.tests = Array.isArray(cached.data.tests) ? cached.data.tests : [];
    APP_STATE.eraTests = Array.isArray(cached.data.eraTests) ? cached.data.eraTests : [];
    APP_STATE.calendarEntries = Array.isArray(cached.data.calendarEntries) ? cached.data.calendarEntries : [];
    APP_STATE.timetable = Array.isArray(cached.data.timetable) ? cached.data.timetable : [];
    APP_STATE.courses = Array.isArray(cached.data.courses) ? cached.data.courses : [];
    APP_STATE.messageGroups = Array.isArray(cached.data.messageGroups) ? cached.data.messageGroups : [];
    APP_STATE.notices = Array.isArray(cached.data.notices) ? cached.data.notices : [];
    APP_STATE.studyContent = Array.isArray(cached.data.studyContent) ? cached.data.studyContent : [];
    APP_STATE.studyTotal = Number(cached.data.studyTotal || APP_STATE.studyContent.length || 0);
    APP_STATE.examTotal = Number(cached.data.examTotal || APP_STATE.tests.length || 0);
    APP_STATE.eraTotal = Number(cached.data.eraTotal || APP_STATE.eraTests.length || 0);
    APP_STATE.lastSyncAt = Number(cached.snapshotAt || Date.now());
    APP_STATE.loadedSections.dashboard = APP_STATE.tests.length > 0 || APP_STATE.calendarEntries.length > 0;
    APP_STATE.loadedSections.courses = APP_STATE.courses.length > 0;
    APP_STATE.loadedSections.messages = APP_STATE.messageGroups.length > 0;
    APP_STATE.loadedSections.notices = APP_STATE.notices.length > 0;
    APP_STATE.loadedSections.study = APP_STATE.studyContent.length > 0;
  
    renderExamHall(APP_STATE.tests);
    renderEraTests(APP_STATE.eraTests);
    renderExamCalendar(APP_STATE.calendarEntries);
    renderTimetable(APP_STATE.timetable);
    renderTodayClasses(APP_STATE.timetable);
    renderCourses(APP_STATE.courses);
    renderMessageGroups(APP_STATE.messageGroups);
    renderNotices(APP_STATE.notices);
    renderStudyContent(APP_STATE.studyContent, APP_STATE.studyTotal);
    updateDashboardWidgets();
  
    const isStale = (Date.now() - APP_STATE.lastSyncAt) > PORTAL_CACHE_TTL_MS;
    setSyncPill('cached', isStale ? `Cached · stale` : `Cached · ${formatRelativeTime(APP_STATE.lastSyncAt)}`);
    return true;
  }
  
  function getTimetableCacheKey() {
    return `fy_timetable_cache_${API_CONFIG.academicYear}_${API_CONFIG.classId || 'none'}`;
  }
  
  function readTimetableCache() {
    try {
      const raw = localStorage.getItem(getTimetableCacheKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.items) ? parsed.items : null;
    } catch (_) {
      return null;
    }
  }
  
  function writeTimetableCache(items) {
    try {
      localStorage.setItem(getTimetableCacheKey(), JSON.stringify({ savedAt: Date.now(), items: Array.isArray(items) ? items : [] }));
    } catch (_) {}
  }
  
  function renderGlobalSkeletons() {
    const targets = [
      ['dashboard-upcoming-list', 3],
      ['today-classes-list', 3],
      ['courses-grid', 6],
      ['msg-group-list', 5],
      ['examhall-list', 4],
      ['era-list', 4],
      ['notice-list', 4],
      ['study-list', 4]
    ];
    targets.forEach(([id, count]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = `<div class="skeleton-stack">${Array.from({ length: count }).map(() => '<div class="skeleton"></div>').join('')}</div>`;
    });
  }
  
  function getFilteredCommands(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter(c => `${c.label} ${c.meta}`.toLowerCase().includes(q));
  }
  
  function renderCommandPaletteList(query = '') {
    const list = document.getElementById('command-list');
    if (!list) return;
    const results = getFilteredCommands(query);
    if (!results.length) {
      list.innerHTML = '<div class="empty" style="padding:18px 0">No matching commands</div>';
      return;
    }
    list.innerHTML = results.map((c, idx) => `<button class="command-item ${idx === 0 ? 'active' : ''}" data-command-id="${c.id}"><span>${escapeHtml(c.label)}</span><span class="command-meta">${escapeHtml(c.meta)}</span></button>`).join('');
    list.querySelectorAll('.command-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const command = COMMANDS.find(c => c.id === btn.dataset.commandId);
        if (!command) return;
        closeCommandPalette();
        command.run();
      });
    });
  }
  
  window.openCommandPalette = function openCommandPalette() {
    const backdrop = document.getElementById('command-palette-backdrop');
    const input = document.getElementById('command-input');
    if (!backdrop || !input) return;
    backdrop.style.display = 'flex';
    input.value = '';
    renderCommandPaletteList('');
    setTimeout(() => input.focus(), 0);
  };
  
  window.closeCommandPalette = function closeCommandPalette(event) {
    if (event && event.target && event.target.id !== 'command-palette-backdrop') return;
    const backdrop = document.getElementById('command-palette-backdrop');
    if (backdrop) backdrop.style.display = 'none';
  };
  
  function refreshActivePageData() {
    const activePage = document.querySelector('.page.active')?.id?.replace('page-', '') || 'dashboard';
    if (activePage === 'dashboard') {
      updateDashboardWidgets();
      renderTodayClasses(APP_STATE.timetable || []);
    }
    if (activePage === 'courses') renderCourses(APP_STATE.courses || []);
    if (activePage === 'messages') renderMessageGroups(APP_STATE.messageGroups || []);
    if (activePage === 'timetable') {
      renderTimetable(APP_STATE.timetable || []);
      renderTodayClasses(APP_STATE.timetable || []);
    }
    if (activePage === 'examhall') renderExamHall(APP_STATE.tests || []);
    if (activePage === 'era') renderEraTests(APP_STATE.eraTests || []);
    if (activePage === 'examcal') renderExamCalendar(APP_STATE.calendarEntries || []);
    if (activePage === 'notices') renderNotices(APP_STATE.notices || []);
    if (activePage === 'study') renderStudyContent(APP_STATE.studyContent || [], APP_STATE.studyTotal || 0);
    if (activePage === 'practice') chemInitApp();
    if (activePage === 'settings') renderThemeSettings();
  }
  
  async function ensureDashboardData(force = false) {
    const hasDashboardData = (APP_STATE.tests || []).length > 0 || (APP_STATE.calendarEntries || []).length > 0;
    if (APP_STATE.loadedSections.dashboard && hasDashboardData && !force) {
      updateDashboardWidgets();
      refreshDashboardForcedStats();
    }
    if (!API_CONFIG.token) return;
    const testsPage = await fetchTestsPage(API_CONFIG.token, 1, APP_STATE.testPageSize);
    const tests = testsPage.tests || [];
    const [calendar, enriched, eraEnriched] = await Promise.all([
      fetchCalendar(API_CONFIG.token),
      enrichExamTests(tests),
      enrichEraTests(tests)
    ]);
    APP_STATE.examPage = 1;
    APP_STATE.eraPage = 1;
    APP_STATE.examTotal = testsPage.total || enriched.length;
    APP_STATE.eraTotal = testsPage.total || eraEnriched.length;
    APP_STATE.tests = enriched;
    APP_STATE.eraTests = eraEnriched;
    APP_STATE.calendarEntries = calendar;
    APP_STATE.loadedSections.dashboard = true;
    renderExamHall(APP_STATE.tests);
    renderEraTests(APP_STATE.eraTests);
    renderExamCalendar(APP_STATE.calendarEntries);
    updateDashboardWidgets();
    await refreshDashboardForcedStats();
    writePortalCache();
  }
  
  async function ensureCoursesData(force = false) {
    if (APP_STATE.loadedSections.courses && !force) renderCourses(APP_STATE.courses || []);
    APP_STATE.courses = await fetchCourses(API_CONFIG.token);
    APP_STATE.loadedSections.courses = true;
    renderCourses(APP_STATE.courses);
    writePortalCache();
  }
  
  async function ensureMessagesData(force = false) {
    if (APP_STATE.loadedSections.messages && !force) renderMessageGroups(APP_STATE.messageGroups || []);
    APP_STATE.messageGroups = await fetchMessageGroups(API_CONFIG.token);
    APP_STATE.loadedSections.messages = true;
    renderMessageGroups(APP_STATE.messageGroups);
    writePortalCache();
  }
  
  async function ensureNoticesData(force = false) {
    if (APP_STATE.loadedSections.notices && !force) renderNotices(APP_STATE.notices || []);
    APP_STATE.notices = await fetchNotices(API_CONFIG.token);
    APP_STATE.loadedSections.notices = true;
    renderNotices(APP_STATE.notices);
    writePortalCache();
  }
  
  async function ensureStudyData(force = false) {
    if (APP_STATE.loadedSections.study && !force) renderStudyContent(APP_STATE.studyContent || [], APP_STATE.studyTotal || 0);
    APP_STATE.studyPage = 1;
    const studyRes = await fetchStudyContent(API_CONFIG.token, APP_STATE.studyPage);
    APP_STATE.studyContent = studyRes.data;
    APP_STATE.studyTotal = studyRes.total || studyRes.data.length;
    APP_STATE.loadedSections.study = true;
    renderStudyContent(APP_STATE.studyContent, APP_STATE.studyTotal);
    writePortalCache();
  }
  
  async function ensureDataForPage(pageId, force = false) {
    if (!API_CONFIG.token) return;
    try {
      if (['dashboard', 'examcal', 'examhall', 'era'].includes(pageId)) await ensureDashboardData(force);
      if (pageId === 'courses') await ensureCoursesData(force);
      if (pageId === 'messages') await ensureMessagesData(force);
      if (pageId === 'notices') await ensureNoticesData(force);
      if (pageId === 'study') await ensureStudyData(force);
    } catch (err) {
      setSyncPill('offline', 'Offline');
    }
  }
  
  function renderSubnav(pageId) {
    const container = document.getElementById('subnav');
    if (!container) return;
    const config = SUBNAV_CONFIG[pageId] || [];
    if (!config.length) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }
    container.style.display = 'flex';
    const current = APP_STATE.activeSubTabs[pageId] || config[0].id;
    APP_STATE.activeSubTabs[pageId] = current;
    container.innerHTML = config.map(tab => `<button class="subnav-chip ${current === tab.id ? 'active' : ''}" onclick="setSubTab('${pageId}','${tab.id}')">${escapeHtml(tab.label)}</button>`).join('');
    if (pageId === 'dashboard') {
      const dashboard = document.getElementById('page-dashboard');
      if (dashboard) dashboard.setAttribute('data-subview', current);
    }
  }
  
  window.setSubTab = function setSubTab(pageId, tabId) {
    APP_STATE.activeSubTabs[pageId] = tabId;
    renderSubnav(pageId);
    refreshActivePageData();
  };
  
  let rankModel = null;
  let rankMeta = null;
  let rankLoading = false;

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${url}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = url;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function initRankPredictor() {
    if (rankModel && rankMeta) return;
    if (rankLoading) return;
    rankLoading = true;

    const dot = document.getElementById("rank-dot");
    const stat = document.getElementById("rank-status");
    const btn = document.getElementById("rank-predict-btn");

    try {
      if (dot) dot.className = "rank-dot loading";
      if (stat) stat.textContent = "Loading TensorFlow.js...";

      await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js");

      if (stat) stat.textContent = "Loading model...";
      
      const [model, meta] = await Promise.all([
        tf.loadLayersModel("models/ranknet/model.json"),
        fetch("models/ranknet/meta.json").then(r => r.json())
      ]);

      rankModel = model;
      rankMeta = meta;

      if (dot) {
        dot.className = "rank-dot ready";
      }
      if (stat) stat.textContent = "Model ready ✓";
      if (btn) btn.disabled = false;
    } catch (e) {
      if (dot) dot.className = "rank-dot error";
      if (stat) stat.textContent = "Failed to load: " + e.message;
      console.error(e);
    } finally {
      rankLoading = false;
    }
  }

  function estimateTopper(avg, maxMarks) {
    if (!rankMeta || !rankMeta.stat_constants) return maxMarks;
    const { slope_tgn, intercept_tgn } = rankMeta.stat_constants;
    const difficulty     = avg / maxMarks;
    const topperGapNorm  = slope_tgn * difficulty + intercept_tgn;
    const topper         = avg + topperGapNorm * maxMarks;
    return Math.min(topper, maxMarks);
  }

  function dynamicK(difficulty) {
    if (!rankMeta || !rankMeta.stat_constants) return 1.0;
    const { slope_k, intercept_k } = rankMeta.stat_constants;
    return slope_k * difficulty + intercept_k;
  }

  function normalizeRankInput(score, avg, maxMarks) {
    const difficulty    = avg / maxMarks;
    const topper        = estimateTopper(avg, maxMarks);
    const k             = dynamicK(difficulty);
    const sigma         = k > 0 ? (topper - avg) / k : 1.0;
    const z             = sigma > 0 ? (score - avg) / sigma : 0.0;
    const gap           = topper - avg;
    let   x_norm        = gap > 0 ? (score - avg) / gap : 0.0;
    const rawX          = x_norm;
    x_norm              = Math.max(0.01, Math.min(x_norm, 1.0));
    const maxMarks_ref  = rankMeta ? rankMeta.maxMarks_ref : 300;
    const maxMarks_norm = maxMarks / maxMarks_ref;
    return { z, x_norm, rawX, difficulty, maxMarks_norm, topper, k, sigma };
  }

  async function predictRank() {
    if (!rankModel || !rankMeta) return;

    const score = parseFloat(document.getElementById("inp-score").value);
    const maxM  = parseFloat(document.getElementById("inp-max").value);
    const avg   = parseFloat(document.getElementById("inp-avg").value);
    const N_in  = parseFloat(document.getElementById("inp-N").value);

    if (isNaN(score) || isNaN(maxM) || isNaN(avg)) {
      alert("Please fill in score, max marks and overall average."); return;
    }
    if (avg >= maxM)  { alert("Average can't exceed max marks."); return; }
    if (score < 0)    { alert("Score can't be negative."); return; }

    const {
      z, x_norm, rawX, difficulty,
      maxMarks_norm, topper, k, sigma
    } = normalizeRankInput(score, avg, maxM);

    // run model
    const input  = tf.tensor2d([[z, x_norm, difficulty, maxMarks_norm]]);
    const output = rankModel.predict(input);
    const pct    = (await output.data())[0] * 100;
    input.dispose(); output.dispose();

    const N    = isNaN(N_in) ? rankMeta.avg_N : N_in;
    const rank = Math.round(N * (1 - pct / 100));
    const gap  = score - avg;

    // ── Update stats ──────────────────────────────────────────────────────────
    document.getElementById("r-pct").textContent      = pct.toFixed(1) + "%";
    document.getElementById("r-prog").style.width     = Math.min(pct,100).toFixed(1) + "%";
    document.getElementById("r-rank").textContent     = "~" + rank;
    document.getElementById("r-rank-sub").textContent = "out of ~" + Math.round(N);
    document.getElementById("r-topper").textContent   = Math.round(topper);
    document.getElementById("r-diff").textContent     = (difficulty * 100).toFixed(1) + "%";
    document.getElementById("r-gap").textContent      = (gap >= 0 ? "+" : "") + gap.toFixed(0);

    // ── Update pipeline ───────────────────────────────────────────────────────
    const tgn = rankMeta.stat_constants.slope_tgn * difficulty + rankMeta.stat_constants.intercept_tgn;
    document.getElementById("p-diff").textContent   = difficulty.toFixed(4);
    document.getElementById("p-tgn").textContent    = tgn.toFixed(4);
    document.getElementById("p-topper").textContent = Math.round(topper) + " / " + maxM;
    document.getElementById("p-k").textContent      = k.toFixed(4);
    document.getElementById("p-sigma").textContent  = sigma.toFixed(4);
    document.getElementById("p-z").textContent      = z.toFixed(4);
    document.getElementById("p-xnorm").textContent  = rawX.toFixed(4) + " → " + x_norm.toFixed(4);
    document.getElementById("p-pct").textContent    = pct.toFixed(3) + "%";

    // ── Alerts ────────────────────────────────────────────────────────────────
    document.getElementById("al-low").style.display    = rawX <= 0.05 ? "block" : "none";
    document.getElementById("al-over").style.display   = rawX > 1.0  ? "block" : "none";
    document.getElementById("al-extrap").style.display = (difficulty < 0.248 || difficulty > 0.594) ? "block" : "none";
    document.getElementById("al-good").style.display   = (rawX > 0.25 && rawX <= 1.0 && difficulty >= 0.248 && difficulty <= 0.594) ? "block" : "none";

    document.getElementById("rank-result").style.display = "block";
    document.getElementById("rank-result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  window.predictRank = predictRank;

  async function nav(id, el) {
    if (id === 'practice') {
      setSyncPill(navigator.onLine ? 'live' : 'offline', navigator.onLine ? 'Syncing progress...' : 'Offline');
      chemEnsureSupabase();
      await chemDownloadProgress(true);
      setSyncPill(navigator.onLine ? 'live' : 'offline', navigator.onLine ? 'Live' : 'Offline');
    }

    const activePageEl = document.querySelector('.page.active');
    const prevPageId = activePageEl ? activePageEl.id.replace('page-', '') : '';

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const msgPage = document.getElementById('page-messages');
    if (msgPage) msgPage.classList.remove('thread-open');
    const page = document.getElementById('page-' + id);
    if (page) page.classList.add('active');
    if (el) el.classList.add('active');
    document.querySelectorAll('.dock-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === id);
    });
    document.getElementById('page-title').textContent = pages[id] || id;
    renderSubnav(id);
    refreshActivePageData();
    ensureDataForPage(id, false);
    document.querySelector('.content').scrollTop = 0;
    if (window.innerWidth <= 768) closeSidebar();

    if (prevPageId === 'practice' && id !== 'practice') {
      chemSyncAll(false);
    }
    if (id === 'neural') {
      initRankPredictor();
    }
  }

  window.sendAnonDataToWorker = async function sendAnonDataToWorker() {
    const button = document.getElementById('neural-anon-btn');
    const status = document.getElementById('neural-status');

    if (!API_CONFIG.token) {
      if (status) status.textContent = 'Login first, then share performance data.';
      return;
    }

    if (typeof scrapeAllTestResults !== 'function' || typeof cleanScrapedTestsData !== 'function') {
      if (status) status.textContent = 'Scraper or cleaner is not loaded.';
      return;
    }

    const setStatus = (message) => {
      if (status) status.textContent = message;
    };

    try {
      if (button) {
        button.disabled = true;
        button.textContent = 'Scraping...';
      }
      setStatus('Scraping tests without leaderboard data...');

      const scraped = await scrapeAllTestResults({
        includeLeaderboard: false,
        includeUnpublished: false,
        download: false
      });

      setStatus('Cleaning scraped test data...');
      const cleanedJson = cleanScrapedTestsData(scraped);

      if (button) button.textContent = 'Sending...';
      setStatus(`Sending ${cleanedJson.length} cleaned test records...`);

      const response = await fetch('https://reciver.evodev.workers.dev/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleanedJson)
      });

      if (!response.ok) {
        throw new Error(`Worker returned HTTP ${response.status}`);
      }

      setStatus(`Done. Sent ${cleanedJson.length} cleaned test records.`);
    } catch (err) {
      console.error(err);
      setStatus(err?.message || 'Failed to share performance data.');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Share Performance Analytics';
      }
    }
  };
  
  window.openEraFromDashboard = function openEraFromDashboard() {
    nav('examcal', document.querySelector('.nav-item[onclick*=examcal]'));
  };
  
  function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlay').style.display = document.getElementById('sidebar').classList.contains('open') ? 'block' : 'none';
  }
  
  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').style.display = 'none';
  }
  
  window.closeMessageThread = function closeMessageThread() {
    const msgPage = document.getElementById('page-messages');
    if (!msgPage) return;
    msgPage.classList.remove('thread-open');
    const title = document.getElementById('msg-thread-title');
    const list = document.getElementById('msg-thread-list');
    if (title) title.textContent = 'Select a conversation';
    if (list) list.innerHTML = '<div class="empty" style="margin:auto">No conversation selected</div>';
  };
  
  window.setThemeMode = function setThemeMode(mode) {
    const body = document.body;
    const useLight = mode === 'light';
    body.classList.toggle('light-mode', useLight);
    localStorage.setItem('fy_theme_mode', useLight ? 'light' : 'dark');
    renderThemeSettings();
  };
  
  window.toggleThemeMode = function toggleThemeMode() {
    const isLight = document.body.classList.contains('light-mode');
    setThemeMode(isLight ? 'dark' : 'light');
  };
  
  function applyThemePreset(presetId, persist = true) {
    const body = document.body;
    body.classList.remove('theme-ocean', 'theme-purple', 'theme-emerald');
    if (presetId && presetId !== 'default') body.classList.add(`theme-${presetId}`);
    APP_STATE.themePreset = presetId || 'default';
    if (persist) localStorage.setItem('fy_theme_preset', APP_STATE.themePreset);
  }
  
  window.selectThemePreset = function selectThemePreset(presetId) {
    applyThemePreset(presetId, true);
    renderThemeSettings();
  };
  
  window.resetAppearance = function resetAppearance() {
    setThemeMode('dark');
    applyThemePreset('default', true);
    renderThemeSettings();
  };
  
  window.clearLocalCache = function clearLocalCache() {
    localStorage.removeItem(PORTAL_CACHE_KEY);
    localStorage.removeItem('fy_theme_mode');
    localStorage.removeItem('fy_theme_preset');
    APP_STATE.loadedSections = {
      dashboard: false,
      courses: false,
      messages: false,
      notices: false,
      study: false
    };
    setSyncPill('cached', 'Local cache cleared');
  };

  window.hardRefreshAndClearCache = async function hardRefreshAndClearCache() {
    localStorage.removeItem(PORTAL_CACHE_KEY);
    Object.keys(localStorage)
      .filter(key => key.startsWith('fy_timetable_cache_'))
      .forEach(key => localStorage.removeItem(key));

    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      } catch (_) {}
    }

    setSyncPill('live', 'Refreshing...');
    window.location.reload();
  };
  
  window.refreshCurrentSection = async function refreshCurrentSection() {
    const activePage = document.querySelector('.page.active')?.id?.replace('page-', '') || 'dashboard';
    await ensureDataForPage(activePage, true);
  };
  
  function renderThemeSettings() {
    const root = document.getElementById('theme-preset-grid');
    if (!root) return;
    const darkBtn = document.getElementById('theme-mode-dark');
    const lightBtn = document.getElementById('theme-mode-light');
    const isLight = document.body.classList.contains('light-mode');
    if (darkBtn) darkBtn.classList.toggle('active', !isLight);
    if (lightBtn) lightBtn.classList.toggle('active', isLight);
    const active = APP_STATE.themePreset || 'default';
    root.innerHTML = THEME_PRESETS.map(p => `
      <button class="theme-preset-btn ${active === p.id ? 'active' : ''}" onclick="selectThemePreset('${p.id}')">
        <div class="theme-preset-name">${escapeHtml(p.label)}</div>
        <div class="theme-preset-preview">
          ${p.colors.map(c => `<span class="theme-dot" style="background:${c}"></span>`).join('')}
        </div>
      </button>
    `).join('');
  }
  
  window.chemToggleTextMode = function(el) {
    localStorage.setItem('chem_setting_text_mode', el.checked ? 'true' : 'false');
  };
  
  window.chemToggleWizardMode = function(el) {
    localStorage.setItem('chem_setting_wizard_mode', el.checked ? 'true' : 'false');
    chemUpdatePracticeButton();
  };

  window.chemChangeRenderer = function(val) {
    localStorage.setItem('chem_setting_renderer', val);
    if (val === 'rdkit') {
      loadRDKitDynamic().then(() => {
        chemShowToast("RDKit JS loaded successfully!");
        chemRefreshCurrentDrawing();
      }).catch(() => {
        chemShowToast("Failed to load RDKit JS. Using Smiles Drawer.");
        const rendererSelect = document.getElementById('chem-setting-renderer');
        if (rendererSelect) rendererSelect.value = 'smiles';
        localStorage.setItem('chem_setting_renderer', 'smiles');
      });
    } else {
      chemRefreshCurrentDrawing();
    }
  };

  function chemUpdatePracticeButton() {
    const btn = document.getElementById('chem-btn-practice');
    if (!btn) return;
    const wizardMode = localStorage.getItem('chem_setting_wizard_mode') === 'true';
    if (wizardMode) {
      btn.textContent = 'Run';
      btn.classList.add('chem-btn-primary');
      btn.classList.remove('chem-btn-secondary');
    } else {
      btn.textContent = 'Practice Mode';
      btn.classList.add('chem-btn-secondary');
      btn.classList.remove('chem-btn-primary');
    }
  }

  function initTopbarEnhancements() {
    if (window.__fyEnhancementsInited) return;
    window.__fyEnhancementsInited = true;

    const textModeSetting = localStorage.getItem('chem_setting_text_mode') !== 'false';
    const checkbox = document.getElementById('chem-setting-text-mode');
    if (checkbox) checkbox.checked = textModeSetting;

    const wizardModeSetting = localStorage.getItem('chem_setting_wizard_mode') === 'true';
    const wizardCheckbox = document.getElementById('chem-setting-wizard-mode');
    if (wizardCheckbox) wizardCheckbox.checked = wizardModeSetting;
    chemUpdatePracticeButton();

    const rendererSetting = localStorage.getItem('chem_setting_renderer') || 'smiles';
    const rendererSelect = document.getElementById('chem-setting-renderer');
    if (rendererSelect) rendererSelect.value = rendererSetting;
    if (rendererSetting === 'rdkit') {
      loadRDKitDynamic();
    }
  
    const savedTheme = localStorage.getItem('fy_theme_mode');
    if (savedTheme === 'light') document.body.classList.add('light-mode');
    const savedPreset = localStorage.getItem('fy_theme_preset') || 'default';
    applyThemePreset(savedPreset, false);
    setSyncPill(navigator.onLine ? 'live' : 'offline', navigator.onLine ? 'Live' : 'Offline');
  
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
      searchInput.value = APP_STATE.globalSearch || '';
      searchInput.addEventListener('input', function onSearchInput() {
        APP_STATE.globalSearch = this.value.trim();
        refreshActivePageData();
      });
    }
  
    const commandInput = document.getElementById('command-input');
    if (commandInput) {
      commandInput.addEventListener('input', function onCommandInput() {
        renderCommandPaletteList(this.value);
      });
      commandInput.addEventListener('keydown', function onCommandKeydown(e) {
        const items = Array.from(document.querySelectorAll('.command-item'));
        if (!items.length) return;
        const activeIndex = items.findIndex(i => i.classList.contains('active'));
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const direction = e.key === 'ArrowDown' ? 1 : -1;
          const nextIndex = activeIndex < 0 ? 0 : (activeIndex + direction + items.length) % items.length;
          items.forEach(i => i.classList.remove('active'));
          items[nextIndex].classList.add('active');
          items[nextIndex].scrollIntoView({ block: 'nearest' });
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          const active = items.find(i => i.classList.contains('active')) || items[0];
          active?.click();
        }
        if (e.key === 'Escape') {
          closeCommandPalette();
        }
      });
    }
  
    document.addEventListener('keydown', (e) => {
      const isCmdPalette = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
      if (isCmdPalette) {
        e.preventDefault();
        openCommandPalette();
        return;
      }
      if (e.key === 'Escape') closeCommandPalette();
    });
  
    window.addEventListener('online', () => {
      setSyncPill('live', 'Back online · syncing');
      chemSyncAll(false);
      refreshPortalDataInBackground();
      setTimeout(() => window.location.reload(), 1200);
    });
    window.addEventListener('offline', () => {
      setSyncPill('offline', 'Offline');
    });
  }
  
  /* --- MESSAGES --- */
  window.selectMessageGroup = async function(groupId, title) {
    currentGroupId = groupId;
    renderMessageGroups(APP_STATE.messageGroups || []);
    const msgPage = document.getElementById('page-messages');
    if (window.innerWidth <= 768 && msgPage) msgPage.classList.add('thread-open');
  
    const threadTitle = document.getElementById('msg-thread-title');
    const threadList = document.getElementById('msg-thread-list');
    if (threadTitle) threadTitle.textContent = title;
    if (threadList) threadList.innerHTML = '<div class="empty" style="margin:auto">Loading messages...</div>';
  
    const messages = await fetchMessages(API_CONFIG.token, groupId);
  
    if (!messages.length) {
      if (threadList) threadList.innerHTML = '<div class="empty" style="margin:auto">No messages in this group</div>';
      return;
    }
  
    // Sort by date so newest messages are at bottom
    messages.sort((a, b) => new Date(a.createdDate) - new Date(b.createdDate));
  
    if (threadList) {
      threadList.innerHTML = messages.map(m => {
        const dateStr = new Date(m.createdDate).toLocaleDateString('en-IN', {month:'short', day:'numeric'});
        let attachHtml = '';
        if (m.attachment) {
          attachHtml = `<div style="margin-top:8px"><a href="${escapeHtml(m.attachment)}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;background:var(--bg4);border:1px solid var(--border);border-radius:6px;font-size:11px;color:var(--text2)"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 1v8M4 6l3 3 3-3M2 11h10"/></svg> View Attachment</a></div>`;
        }
        return `
          <div class="msg-bubble">
            <div class="msg-bubble-text">${formatMessageText(m.messageText)}</div>
            ${attachHtml}
            <div class="msg-bubble-meta">${escapeHtml(m.displayTime)} · ${escapeHtml(dateStr)}</div>
          </div>
        `;
      }).join('');
      threadList.scrollTop = threadList.scrollHeight;
    }
  };
  
  /* --- ATTENDANCE --- */
  window.openAttendanceModal = function() {
    ensureAttendanceModal();
    const now = new Date();
    const mSelect = document.getElementById('att-month');
    const ySelect = document.getElementById('att-year');
  
    if (!mSelect.options.length) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      months.forEach((m, i) => mSelect.add(new Option(m, i + 1)));
      const curY = now.getFullYear();
      for(let y = curY - 1; y <= curY + 1; y++) ySelect.add(new Option(y, y));
      mSelect.value = now.getMonth() + 1;
      ySelect.value = curY;
    }
    
    document.getElementById('att-modal-backdrop').style.display = 'flex';
    renderAttendanceModal(); // Auto-load initially
  }
  
  window.renderAttendanceModal = async function() {
    const body = document.getElementById('att-modal-body');
    body.innerHTML = '<div class="empty">Loading...</div>';
    
    const m = document.getElementById('att-month').value;
    const y = document.getElementById('att-year').value;
    const data = await fetchAttendance(API_CONFIG.token, Number(m), Number(y));
    
    if (!data.length) {
      body.innerHTML = '<div class="empty">No attendance records found</div>';
      return;
    }
  
    body.innerHTML = data.map(d => {
      const bg = d.isPresent ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.15)';
      const color = d.isPresent ? 'var(--green)' : 'var(--red)';
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px">
          <div style="font-size:13px;color:var(--text);font-weight:500">${escapeHtml(d.classDate)}</div>
          <div style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;background:${bg};color:${color}">${d.isPresent ? 'Present' : 'Absent'}</div>
        </div>`;
    }).join('');
  }
  
  async function loadCurrentAttendance() {
    const now = new Date();
    const data = await fetchAttendance(API_CONFIG.token, now.getMonth() + 1, now.getFullYear());
    
    const valEl = document.getElementById('att-val');
    const subEl = document.getElementById('att-sub');
    if(!valEl || !subEl) return;
  
    if(!data.length) {
      valEl.textContent = 'N/A';
      subEl.innerHTML = 'No data this month';
      return;
    }
  
    const total = data.length;
    const present = data.filter(d => d.isPresent).length;
    const absent = total - present;
    const pct = Math.round((present / total) * 100);
  
    valEl.textContent = pct + '%';
    subEl.innerHTML = absent > 0 
      ? `<span class="dn">${absent} class${absent > 1 ? 'es' : ''}</span> missed this month` 
      : `<span class="up">Perfect attendance</span> this month`;
  }
  
  /* --- EXAMS & RESULTS --- */
  async function openResultSubpage(testId, options = {}) {
    const cleanId = String(testId || '').trim();
    if (!cleanId || !API_CONFIG.token) return;
    APP_STATE.lastResultSource = options.source || (options.forced ? 'era' : 'examhall');
    const body = document.getElementById('result-detail-body');
    nav('result-detail');
    if (body) body.innerHTML = `<div class="empty">${options.forced ? 'Forcing result fetch...' : 'Loading result...'}</div>`;
  
    try {
      const allTests = [...(APP_STATE.tests || []), ...(APP_STATE.eraTests || [])];
      const selected = allTests.find(t => String(t.id || '') === cleanId || String(t.testPaperId || '') === cleanId) || null;
      const appearedReqId = selected?.id || cleanId;
      const appeared = await fetchAppearedResult(API_CONFIG.token, appearedReqId);
      const examId = appeared?.examId;
      if (!examId) {
        if (body) body.innerHTML = `<div class="empty">No examId returned for this test. The request completed, but result analysis cannot be fetched.</div><details open style="margin-top:10px"><summary style="font-size:12px;color:var(--accent);cursor:pointer">Appeared result raw data</summary><pre style="margin-top:8px;background:#05070b;border:1px solid var(--border);border-radius:8px;padding:10px;white-space:pre-wrap;overflow:auto;font-size:11px;color:var(--text2)">${escapeHtml(JSON.stringify(appeared, null, 2))}</pre></details>`;
        return;
      }
  
      const key = `${options.forced ? 'era:' : ''}${examId}`;
      let analysis = APP_STATE.resultCache[key];
      if (!analysis) {
        analysis = await fetchResultAnalysis(API_CONFIG.token, examId);
        if (analysis) APP_STATE.resultCache[key] = analysis;
      }
      if (!analysis?.result) {
        if (body) body.innerHTML = '<div class="empty">Result analysis did not return parsed result data.</div>';
        return;
      }
  
      const leaderboardId = selected?.id || cleanId || selected?.testPaperId || analysis?.testPaperId;
      const leaderboard = await fetchLeaderboardScore(API_CONFIG.token, leaderboardId);
      APP_STATE.currentResult = { analysis, selected, appeared, leaderboard, forced: Boolean(options.forced) };
      if (body) body.innerHTML = buildResultAnalysisHtml(analysis, selected, { forced: Boolean(options.forced), appeared, includeRaw: Boolean(options.forced), leaderboard, showLeaderboardButton: true });
    } catch (err) {
      if (body) body.innerHTML = `<div class="empty">${escapeHtml(err?.message || 'Failed to load result')}</div>`;
    }
  }
  
  window.openExamResult = function openExamResult(testId) {
    openResultSubpage(testId, { forced: false, source: 'examhall' });
  };
  
  window.openEraForcedResult = function openEraForcedResult(testId) {
    openResultSubpage(testId, { forced: true, source: 'era' });
  };

  window.openForcedResultByTestId = function openForcedResultByTestId(event) {
    if (event?.preventDefault) event.preventDefault();
    const input = document.getElementById('manual-force-test-id');
    const testId = String(input?.value || '').trim();
    if (!testId) {
      if (input) input.focus();
      return;
    }
    openResultSubpage(testId, { forced: true, source: 'era' });
  };

  window.scanTestIds = async function scanTestIds(startId, endId, options = {}) {
    const start = Number(startId);
    const end = Number(endId);
    if (!API_CONFIG.token) {
      console.warn('[scanTestIds] Login first, then run scanTestIds(startId, endId).');
      return [];
    }
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      console.warn('[scanTestIds] Usage: scanTestIds(1000, 1050)');
      return [];
    }

    const from = Math.min(start, end);
    const to = Math.max(start, end);
    const delayMs = Number(options.delayMs ?? 120);
    const found = [];
    console.log(`[scanTestIds] Scanning test IDs ${from} to ${to}...`);

    for (let id = from; id <= to; id += 1) {
      try {
        const appeared = await fetchAppearedResult(API_CONFIG.token, id);
        const examId = appeared?.examId;
        if (examId) {
          const cacheKey = `scan:${examId}`;
          let analysis = APP_STATE.resultCache[cacheKey];
          if (!analysis) {
            analysis = await fetchResultAnalysis(API_CONFIG.token, examId);
            if (analysis) APP_STATE.resultCache[cacheKey] = analysis;
          }
          const name = analysis?.testName || appeared?.testName || appeared?.name || `Exam ${examId}`;
          const row = { testId: id, examId, name };
          found.push(row);
          console.log(`[scanTestIds] ${id}: ${name}`);
        }
      } catch (err) {
        if (options.verbose) console.warn(`[scanTestIds] ${id}: ${err?.message || 'failed'}`);
      }
      if (delayMs > 0 && id < to) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.table(found);
    console.log(`[scanTestIds] Done. Found ${found.length} result${found.length === 1 ? '' : 's'}.`);
    return found;
  };
  
  window.openCurrentLeaderboard = function openCurrentLeaderboard() {
    const body = document.getElementById('leaderboard-body');
    const current = APP_STATE.currentResult;
    nav('leaderboard');
    if (!body) return;
    if (!current) {
      body.innerHTML = '<div class="empty">Open a result first.</div>';
      return;
    }
    body.innerHTML = `<div class="result-title">${escapeHtml(current.analysis?.testName || current.selected?.testName || 'Leaderboard')}</div><div class="result-sub">Top 50 students by marks with subject-wise scores.</div>${buildLeaderboardHtml(current.analysis, current.leaderboard)}`;
  };
  
  window.backToResultsList = function backToResultsList() {
    nav(APP_STATE.lastResultSource === 'era' ? 'era' : 'examhall');
  };
  
  window.openCalendarTest = function openCalendarTest(index) {
    const t = APP_STATE.calendarEntries[Number(index)];
    if (!t) { showResultModal('<div class="empty">Invalid calendar index</div>'); return; }
  
    const venue = t.venue ? escapeHtml(t.venue) : 'N/A';
    const syllabusLines = Array.isArray(t.syllabusLines) && t.syllabusLines.length ? t.syllabusLines : ['N/A'];
    const syllabusHtml = syllabusLines.map(line => `<div style="margin-top:4px">${escapeHtml(line)}</div>`).join('');
    
    showResultModal(
      `<div style="font-size:14px;color:var(--text);font-weight:600">${escapeHtml(t.name)}</div>
       <div style="margin-top:10px;font-size:12px;color:var(--text2)"><strong style="color:var(--text3)">Date:</strong> ${escapeHtml(formatDateTimeLabel(t.dateTime))}</div>
       <div style="margin-top:10px;font-size:12px;color:var(--text2)"><strong style="color:var(--text3)">Venue:</strong><div style="margin-top:4px;white-space:pre-wrap">${venue}</div></div>
       <div style="margin-top:10px;font-size:12px;color:var(--text2)"><strong style="color:var(--text3)">Syllabus:</strong>${syllabusHtml}</div>`
    );
  };
  
  function ensureCourseDetailModal() {
    if (document.getElementById('course-detail-modal-backdrop')) return;
    const wrapper = document.createElement('div');
    wrapper.id = 'course-detail-modal-backdrop';
    wrapper.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:none;align-items:center;justify-content:center;z-index:5000;padding:16px';
    wrapper.innerHTML = `
      <div class="course-detail-modal-card">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border);flex-shrink:0">
          <div id="course-detail-modal-title" style="font-size:15px;font-weight:600;color:var(--text);line-height:1.35">Course details</div>
          <button type="button" onclick="closeCourseDetailModal()" style="background:var(--bg3);color:var(--text2);border:1px solid var(--border);border-radius:8px;padding:5px 10px;cursor:pointer;flex-shrink:0">Close</button>
        </div>
        <div id="course-detail-modal-body" style="padding:16px;overflow-y:auto;flex:1;min-height:0"></div>
      </div>`;
    wrapper.addEventListener('click', (e) => { if (e.target === wrapper) closeCourseDetailModal(); });
    document.body.appendChild(wrapper);
  }
  
  function closeCourseDetailModal() {
    const el = document.getElementById('course-detail-modal-backdrop');
    if (el) el.style.display = 'none';
  }
  
  function buildCourseDetailBodyHtml(d) {
    if (!d) return '<div class="empty">No details returned.</div>';
    const metaParts = [];
    if (d.courseMedium) metaParts.push(escapeHtml(d.courseMedium));
    if (d.startDate) metaParts.push(`Start: ${escapeHtml(d.startDate)}`);
    if (d.expiryDate) metaParts.push(`Expiry: ${escapeHtml(d.expiryDate)}`);
    if (d.batchName) metaParts.push(`Batch: ${escapeHtml(d.batchName)}`);
    if (d.registrationNo) metaParts.push(`Reg: ${escapeHtml(d.registrationNo)}`);
    const imgUrl = d.detailImage || d.image;
    const hero = imgUrl
      ? `<div style="margin-bottom:14px;border-radius:10px;overflow:hidden;border:1px solid var(--border)"><img src="${escapeHtml(imgUrl)}" alt="" style="width:100%;max-height:220px;object-fit:cover;display:block"/></div>`
      : '';
    const fees = d.courseFees;
    let feeBlock = '';
    if (fees && (fees.price != null || fees.displayPrice != null)) {
      const display = fees.displayPrice != null ? fees.displayPrice : fees.price;
      const strike = fees.displayPrice != null && fees.price != null && Number(fees.displayPrice) !== Number(fees.price)
        ? ` <span style="text-decoration:line-through;color:var(--text3);font-size:12px">${escapeHtml(String(fees.price))}</span>` : '';
      feeBlock = `<div style="margin-top:4px;padding:12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;font-size:13px;color:var(--text)"><strong style="color:var(--text2)">Fee</strong> · ${escapeHtml(String(display))}${strike}</div>`;
    }
    const campusBlock = Array.isArray(d.campus) && d.campus.length
      ? `<div style="margin-top:12px"><div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px">Campus</div><ul style="margin:0;padding-left:18px;font-size:13px;color:var(--text2);line-height:1.5">${d.campus.map(c => `<li>${escapeHtml(c.campusName || '')}</li>`).join('')}</ul></div>`
      : '';
    const liveChip = d.isLive ? '<span style="display:inline-block;margin-top:10px;padding:4px 10px;border-radius:20px;background:rgba(239,68,68,0.15);color:var(--red);font-size:11px;font-weight:600">Live</span>' : '';
    const videoBlock = d.videoUrl
      ? `<div style="margin-top:12px"><a href="${escapeHtml(d.videoUrl)}" target="_blank" rel="noopener noreferrer" class="start-btn" style="display:inline-block;margin:0;text-decoration:none">Watch video</a></div>`
      : '';
    const scholarship = d.scholarshipDescription
      ? `<div style="margin-top:14px;padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--bg3)" class="course-detail-prose">${d.scholarshipDescription}</div>`
      : '';
    const desc = d.description
      ? `<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:14px" class="course-detail-prose">${d.description}</div>`
      : '';
    return `${hero}
      <div style="font-size:12px;color:var(--text2);display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center">${metaParts.map(p => `<span>${p}</span>`).join('<span style="color:var(--border2)">·</span>')}</div>
      ${liveChip}
      ${feeBlock}
      ${campusBlock}
      ${videoBlock}
      ${scholarship}
      ${desc}`;
  }
  
  window.openCourseDetail = async function openCourseDetail(courseId) {
    const id = Number(courseId);
    if (!id || !API_CONFIG.token) return;
    ensureCourseDetailModal();
    const backdrop = document.getElementById('course-detail-modal-backdrop');
    const body = document.getElementById('course-detail-modal-body');
    const titleEl = document.getElementById('course-detail-modal-title');
    if (!backdrop || !body) return;
    body.innerHTML = '<div class="empty">Loading course…</div>';
    if (titleEl) titleEl.textContent = 'Course details';
    backdrop.style.display = 'flex';
    try {
      const d = await fetchCourseDetail(API_CONFIG.token, id);
      if (!d) {
        body.innerHTML = '<div class="empty">Could not load this course. It may be unavailable or your session may have expired.</div>';
        return;
      }
      if (titleEl) titleEl.textContent = d.title || 'Course details';
      body.innerHTML = buildCourseDetailBodyHtml(d);
    } catch (err) {
      body.innerHTML = `<div class="empty">${escapeHtml(err?.message || 'Failed to load course')}</div>`;
    }
  };
  
  /* --- FILE OPENERS --- */
  window.openNoticeFile = async function(id) {
    if (!API_CONFIG.token) return;
    try {
      const res = await fetch(API_ENDPOINTS.noticeFile(id), { method: 'GET', headers: authHeaders(API_CONFIG.token) });
      const json = await res.json();
      if (json?.data) window.open(json.data, '_blank');
      else alert('Notice file URL not found.');
    } catch (err) { alert('Failed to open notice.'); }
  };
  
  window.openStudyFile = async function(id) {
    if (!API_CONFIG.token) return;
    try {
      const res = await fetch(API_ENDPOINTS.studyFile(id), { method: 'GET', headers: authHeaders(API_CONFIG.token) });
      const json = await res.json();
      if (json?.data) window.open(json.data, '_blank');
      else alert('Study file URL not found.');
    } catch (err) { alert('Failed to open study content.'); }
  };
  
  /* --- DROPDOWN CHANGE HANDLERS & LOADERS --- */
  window.changeTtYear = async function(newYear) {
    API_CONFIG.academicYear = Number(newYear);
    sessionStorage.setItem('fy_academic_year', newYear);
    await loadTtBatches();
  };
  
  window.changeTtBatch = async function(newBatchId) {
    API_CONFIG.classId = Number(newBatchId);
    sessionStorage.setItem('fy_class_id', newBatchId);
    
    const grid = document.getElementById('timetable-grid');
    const todayList = document.getElementById('today-classes-list');
    if(grid) grid.innerHTML = '<div class="empty">Loading timetable...</div>';
    if(todayList) todayList.innerHTML = '<div class="empty">Loading today\'s classes...</div>';
  
    const cachedTimetable = readTimetableCache();
    if (cachedTimetable?.length) {
      APP_STATE.timetable = cachedTimetable;
      renderTimetable(cachedTimetable);
      renderTodayClasses(cachedTimetable);
      setSyncPill('cached', 'Using cached timetable');
    }
  
    try {
      const timetable = await fetchTimetable(API_CONFIG.token);
      APP_STATE.timetable = timetable;
      writeTimetableCache(timetable);
      writePortalCache();
      renderTimetable(timetable);
      renderTodayClasses(timetable);
      setSyncPill('live', `Live · ${formatRelativeTime(APP_STATE.lastSyncAt || Date.now())}`);
    } catch (e) {
      if(!cachedTimetable?.length && grid) grid.innerHTML = '<div class="empty">Failed to load timetable</div>';
      if (!cachedTimetable?.length) setSyncPill('offline', 'Offline');
    }
  };

  window.loadTimetableByBatchId = async function loadTimetableByBatchId(event) {
    if (event?.preventDefault) event.preventDefault();
    const input = document.getElementById('manual-batch-id');
    const rawBatchId = String(input?.value || '').trim();
    if (!rawBatchId) {
      if (input) input.focus();
      return;
    }

    const batchSelector = document.getElementById('tt-batch-selector');
    if (batchSelector && ![...batchSelector.options].some(option => String(option.value) === rawBatchId)) {
      batchSelector.add(new Option(`Manual batch ${rawBatchId}`, rawBatchId, false, true));
      batchSelector.style.display = 'block';
    }
    if (batchSelector) batchSelector.value = rawBatchId;
    await changeTtBatch(rawBatchId);
  };
  
  async function loadTtBatches() {
    const batchSelector = document.getElementById('tt-batch-selector');
    if(!batchSelector) return;
    
    batchSelector.innerHTML = '<option>Loading batches...</option>';
    batchSelector.style.display = 'block';
    
    const batches = await fetchStudentBatches(API_CONFIG.token, API_CONFIG.academicYear);
    
    if (batches.length > 0) {
      if (!API_CONFIG.classId || !batches.find(b => String(b.id) === String(API_CONFIG.classId))) {
        API_CONFIG.classId = batches[0].id;
        sessionStorage.setItem('fy_class_id', API_CONFIG.classId);
      }
      
      batchSelector.innerHTML = batches.map(b => 
        `<option value="${b.id}" ${String(b.id) === String(API_CONFIG.classId) ? 'selected' : ''}>${escapeHtml(b.title)}</option>`
      ).join('');
      
      await changeTtBatch(API_CONFIG.classId);
    } else {
      batchSelector.innerHTML = '<option value="">No batches found</option>';
      document.getElementById('timetable-grid').innerHTML = '<div class="empty">No batches available for this year</div>';
      document.getElementById('today-classes-list').innerHTML = '<div class="empty">No batches available</div>';
    }
    return batches;
  }
  
  function initTtDropdowns() {
    const yearSelector = document.getElementById('tt-year-selector');
    if(yearSelector && yearSelector.options.length === 0) {
      const currentYear = new Date().getFullYear();
      for(let y = currentYear - 1; y <= currentYear + 1; y++) {
        yearSelector.add(new Option(`${y} - ${y+1}`, y, false, y === API_CONFIG.academicYear));
      }
    }
  }
  
  window.changeExamYear = async function(newYear) {
    API_CONFIG.academicYear = Number(newYear);
    sessionStorage.setItem('fy_academic_year', newYear);
    const eraYearSelector = document.getElementById('era-year-selector');
    if (eraYearSelector) eraYearSelector.value = newYear;
    await loadExamTestsPage(true);
  };
  
  function initExamDropdowns() {
    const yearSelector = document.getElementById('exam-year-selector');
    if(yearSelector && yearSelector.options.length === 0) {
      const currentYear = new Date().getFullYear();
      for(let y = currentYear - 1; y <= currentYear + 1; y++) {
        yearSelector.add(new Option(`${y} - ${y+1}`, y, false, y === API_CONFIG.academicYear));
      }
    }
  }
  
  window.changeEraYear = async function(newYear) {
    API_CONFIG.academicYear = Number(newYear);
    sessionStorage.setItem('fy_academic_year', newYear);
    const examYearSelector = document.getElementById('exam-year-selector');
    if (examYearSelector) examYearSelector.value = newYear;
    await loadEraTestsPage(true);
  };
  
  function initEraDropdowns() {
    const yearSelector = document.getElementById('era-year-selector');
    if(yearSelector && yearSelector.options.length === 0) {
      const currentYear = new Date().getFullYear();
      for(let y = currentYear - 1; y <= currentYear + 1; y++) {
        yearSelector.add(new Option(`${y} - ${y+1}`, y, false, y === API_CONFIG.academicYear));
      }
    }
  }
  
  async function enrichExamTests(tests) {
    return Promise.all(tests.map(async test => {
      if (!test.isPublish) return test;
      const testId = test.id || test.testPaperId;
      if (!testId) return test;
      return { ...test, appeared: await fetchAppearedResult(API_CONFIG.token, testId) };
    }));
  }
  
  async function enrichEraTests(tests) {
    return Promise.all(tests.map(async test => {
      const testId = test.id || test.testPaperId;
      if (!testId) return test;
      const appeared = await fetchAppearedResult(API_CONFIG.token, testId);
      return { ...test, appeared: appeared || test.appeared || null };
    }));
  }
  
  async function loadExamTestsPage(reset = false) {
    const root = document.getElementById('examhall-list');
    const btn = document.getElementById('examhall-load-more');
    if (reset) {
      APP_STATE.examPage = 1;
      APP_STATE.tests = [];
      APP_STATE.examTotal = 0;
      if (root) root.innerHTML = '<div class="empty">Loading exam hall tests...</div>';
    }
    if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }
  
    try {
      const page = reset ? 1 : APP_STATE.examPage + 1;
      const { tests, total } = await fetchTestsPage(API_CONFIG.token, page, APP_STATE.testPageSize);
      const enriched = await enrichExamTests(tests);
      APP_STATE.examPage = page;
      APP_STATE.examTotal = total || (reset ? enriched.length : APP_STATE.examTotal);
      APP_STATE.tests = reset ? enriched : [...APP_STATE.tests, ...enriched];
      renderExamHall(APP_STATE.tests);
      writePortalCache();
    } catch(e) {
      if (root) root.innerHTML = '<div class="empty">Failed to load tests</div>';
      updateExamLoadMoreButton();
    } finally {
      if (btn) btn.disabled = false;
    }
  }
  
  async function loadEraTestsPage(reset = false) {
    const root = document.getElementById('era-list');
    const btn = document.getElementById('era-load-more');
    if (reset) {
      APP_STATE.eraPage = 1;
      APP_STATE.eraTests = [];
      APP_STATE.eraTotal = 0;
      if (root) root.innerHTML = '<div class="empty">Loading tests...</div>';
    }
    if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }
  
    try {
      const page = reset ? 1 : APP_STATE.eraPage + 1;
      const { tests, total } = await fetchTestsPage(API_CONFIG.token, page, APP_STATE.testPageSize);
      const enriched = await enrichEraTests(tests);
      APP_STATE.eraPage = page;
      APP_STATE.eraTotal = total || (reset ? enriched.length : APP_STATE.eraTotal);
      APP_STATE.eraTests = reset ? enriched : [...APP_STATE.eraTests, ...enriched];
      renderEraTests(APP_STATE.eraTests);
      writePortalCache();
    } catch(e) {
      if (root) root.innerHTML = '<div class="empty">Failed to load ERA tests</div>';
      updateEraLoadMoreButton();
    } finally {
      if (btn) btn.disabled = false;
    }
  }
  
  window.loadMoreExamTests = function loadMoreExamTests() {
    loadExamTestsPage(false);
  };
  
  window.loadMoreEraTests = function loadMoreEraTests() {
    loadEraTestsPage(false);
  };
  
  window.loadMoreStudyContent = async function() {
    const btn = document.getElementById('study-load-more');
    if(btn) { btn.textContent = 'Loading...'; btn.disabled = true; }
    
    try {
      APP_STATE.studyPage += 1;
      const result = await fetchStudyContent(API_CONFIG.token, APP_STATE.studyPage);
      APP_STATE.studyContent = [...APP_STATE.studyContent, ...result.data];
      APP_STATE.studyTotal = result.total || APP_STATE.studyTotal || APP_STATE.studyContent.length;
      
      renderStudyContent(APP_STATE.studyContent, APP_STATE.studyTotal);
      writePortalCache();
    } catch (_) {
      setSyncPill('offline', 'Offline');
    }
    
    if(btn) { btn.textContent = 'Load More'; btn.disabled = false; }
  };
  
  /* --- BOOTSTRAP / DATA LOADING --- */
  
  async function refreshDashboardForcedStats() {
    const tests = (APP_STATE.eraTests || [])
      .filter(t => (t?.appeared?.examId || t?.id || t?.testPaperId))
      .sort((a, b) => new Date(b.examDate || b.testDate || b.startDate || 0) - new Date(a.examDate || a.testDate || a.startDate || 0));
  
    let summary = null;
    for (const test of tests.slice(0, 8)) {
      const testId = test.id || test.testPaperId;
      let appeared = test.appeared || null;
      if (!appeared && testId) appeared = await fetchAppearedResult(API_CONFIG.token, testId);
      const examId = appeared?.examId;
      if (!examId) continue;
      const cacheKey = `dash:${examId}`;
      let analysis = APP_STATE.resultCache[cacheKey];
      if (!analysis) {
        analysis = await fetchResultAnalysis(API_CONFIG.token, examId);
        if (analysis) APP_STATE.resultCache[cacheKey] = analysis;
      }
      if (!analysis?.result) continue;
      const rankVal = analysis.batchRank ?? analysis.rank ?? appeared?.batchRank ?? appeared?.rank ?? null;
      summary = {
        testName: analysis.testName || test.testName || 'Latest Test',
        marks: analysis.result.totalMarks ?? appeared?.totalMarks ?? null,
        totalMarks: analysis.result.totalSubjectMarks ?? appeared?.totalSubjectMarks ?? null,
        rank: rankVal,
        batchRank: analysis.batchRank ?? rankVal
      };
      break;
    }
    APP_STATE.dashboardForcedStats = summary;
    updateDashboardWidgets();
  }
  
  async function refreshPortalDataInBackground() {
    if (!API_CONFIG.token) return;
    if (APP_STATE.isRefreshing) return;
    APP_STATE.isRefreshing = true;
    try {
      const activePage = document.querySelector('.page.active')?.id?.replace('page-', '') || 'dashboard';
      await ensureDataForPage(activePage, true);
      if (activePage === 'timetable' || activePage === 'dashboard') {
        loadTtBatches();
        loadCurrentAttendance();
      }
      setSyncPill('live', `Live · ${formatRelativeTime(APP_STATE.lastSyncAt || Date.now())}`);
    } catch (_) {
      const hadCache = Boolean(readPortalCache());
      setSyncPill(hadCache ? 'cached' : 'offline', hadCache ? 'Offline · showing cache' : 'Offline');
    } finally {
      APP_STATE.isRefreshing = false;
    }
  }
  
  function startBackgroundRefreshLoop() {
    if (window.__fyRefreshLoopStarted) return;
    window.__fyRefreshLoopStarted = true;
    window.setInterval(refreshPortalDataInBackground, PORTAL_REFRESH_INTERVAL_MS);
  }
  
  async function loadPortalData() {
    if (!API_CONFIG.token) return;
    initTopbarEnhancements();
    renderSubnav('dashboard');
    renderGlobalSkeletons();
    setUserProfileDetails();
    const hasCache = hydratePortalCache();
    if (hasCache) {
      refreshActivePageData();
      refreshDashboardForcedStats();
    }
    
    try {
      // Initialize dashboard-critical data first; other tabs load on-demand.
      initTtDropdowns();
      loadTtBatches();
      initExamDropdowns();
      initEraDropdowns();
      loadCurrentAttendance();
      await ensureDashboardData(false);
      setSyncPill('live', `Live · ${formatRelativeTime(APP_STATE.lastSyncAt || Date.now())}`);
    } catch (err) {
      const hasCache = Boolean(readPortalCache());
      if (!hasCache) {
        renderApiError(err?.message || 'Failed to load API data');
        setSyncPill('offline', 'Offline');
        throw err; // Throw error to trigger auto-relogin if token expired
      }
      setSyncPill('cached', 'Offline · showing cache');
    } finally {
      startBackgroundRefreshLoop();
    }

    // Load chemistry progress asap on login
    chemInitApp().then(() => {
      chemDownloadProgress(false).then(loaded => {
        if (loaded) {
          chemUpdateDashboard();
        }
      });
    }).catch(err => {
      console.error("Failed to load chemistry progress on login:", err);
    });
  }
  
  /* --- COOKIES & AUTH UTILS --- */
  function setCookie(name, value, days) {
    let expires = "";
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + encodeURIComponent(value || "") + expires + "; path=/";
  }
  
  function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i=0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1,c.length);
      if (c.indexOf(nameEQ) === 0) {
        const value = c.substring(nameEQ.length,c.length);
        try { return decodeURIComponent(value); } catch (_) { return value; }
      }
    }
    return null;
  }
  
  function eraseCookie(name) { document.cookie = name + '=; Max-Age=-99999999; path=/'; }
  
  async function attemptLogin(user, pass) {
    const encryptedPassword = encryptLoginPassword(pass);
    const res = await loginProxyFetch(API_ENDPOINTS.login, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ userName: user, password: encryptedPassword, deviceType: "Web", browser: "firefox", appVersion: "", deviceToken: "" })
    });
    const json = await res.json();
    const { payload, data, token } = normalizeLoginResponse(json);
  
    if (!res.ok || !token || (payload.statusCode && payload.statusCode !== 200)) {
      throw new Error(payload.message || data?.message || 'Login failed. Please check your credentials.');
    }
    
    API_CONFIG.token = token;
    sessionStorage.setItem('fy_token', token);
    
    if (data.academicYear) {
      API_CONFIG.academicYear = data.academicYear;
      sessionStorage.setItem('fy_academic_year', data.academicYear);
    }
    
    const cId = data.studentDetail?.curentClassId;
    if (cId) {
      API_CONFIG.classId = cId;
      sessionStorage.setItem('fy_class_id', cId);
    } else {
      API_CONFIG.classId = null;
      sessionStorage.removeItem('fy_class_id');
    }
  
    if (data.studentDetail) {
      sessionStorage.setItem('fy_user_name', data.studentDetail.name || 'Student');
      if(data.studentDetail.profileImage) sessionStorage.setItem('fy_user_img', data.studentDetail.profileImage);
    }
  
    // Save credentials for Auto-Relogin (Valid for 30 days)
    setCookie('fy_u', user, 30);
    setCookie('fy_p', pass, 30);
  }
  
  /* --- LOGIN HANDLING & APP START --- */
  document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    const errEl = document.getElementById('login-error');
    const btn = document.getElementById('login-submit');
    
    errEl.textContent = '';
    btn.textContent = 'Logging in...';
    btn.disabled = true;
    
    try {
      await attemptLogin(user, pass);
      document.getElementById('login-screen').style.display = 'none';
      loadPortalData();
    } catch (err) {
      errEl.textContent = err.message;
    } finally {
      btn.textContent = 'Login';
      btn.disabled = false;
    }
  });
  
  window.logout = function() {
    sessionStorage.clear();
    eraseCookie('fy_u');
    eraseCookie('fy_p');
    location.reload();
  }

  /* --- CHEMISTRY PRACTICE --- */
  const CHEM_SUPABASE_URL = "https://rhsrrljgejgyqnndcdia.supabase.co";
  const CHEM_SUPABASE_KEY = "sb_publishable_vGRx87SiIMaJXeGnrMVN9g_bLPu899U";
  const CHEM_DATA_KEY = 'chem_v5_data';
  let chemSupabase = null;
  let chemDrawer = null;
  let chemAllCompounds = [];
  let chemLearnQueue = [];
  let chemLearnIdx = 0;
  let chemWizardQueue = [];
  let chemWizardIdx = 0;
  let chemPracticeSessionCount = 0;
  let chemPracticeCorrectCount = 0;
  let chemLastPracticeName = null;
  let chemAppReady = false;
  let chemSyncQueue = Promise.resolve();

  let chemMyData = chemReadSavedData();

  function chemReadSavedData() {
    try {
      return JSON.parse(localStorage.getItem(CHEM_DATA_KEY) || 'null') || {
        myList: [],
        stats: {},
        dailyStats: {}
      };
    } catch (_) {
      return { myList: [], stats: {}, dailyStats: {} };
    }
  }

  function chemTodayKey() {
    return getIstDateKey();
  }

  function chemDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function chemRecentStartKey(days = 7) {
    const d = new Date();
    d.setDate(d.getDate() - Math.max(0, days - 1));
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  }

  function chemEnsureDailyStats() {
    if (!chemMyData.dailyStats) chemMyData.dailyStats = {};
    if (!chemMyData.stats) chemMyData.stats = {};
    if (!Array.isArray(chemMyData.myList)) chemMyData.myList = [];
  }

  function chemNormalizeProgressData(source = {}) {
    return {
      myList: Array.isArray(source.myList) ? source.myList : [],
      stats: source.stats && typeof source.stats === 'object' ? source.stats : {},
      dailyStats: source.dailyStats && typeof source.dailyStats === 'object' ? source.dailyStats : {}
    };
  }

  function chemProgressAttemptedTotal(source = {}) {
    return Object.values(source.dailyStats || {}).reduce((total, stats) => {
      return total + Number(stats?.attempted || 0);
    }, 0);
  }

  function chemCurrentUserName() {
    return (sessionStorage.getItem('fy_user_name') || 'Student').trim() || 'Student';
  }

  function chemBuildDailyPayload(statDate, stats) {
    const ntscName = chemCurrentUserName();
    return {
      user_id: ntscName,
      username: ntscName,
      stat_date: statDate,
      correct: stats?.correct || 0,
      wrong: stats?.wrong || 0,
      attempted: stats?.attempted || 0,
      time_spent: stats?.timeSpent || stats?.time_spent || 0
    };
  }

  function chemBuildProgressPayload() {
    const ntscName = chemCurrentUserName();
    return {
      user_id: ntscName,
      username: ntscName,
      my_list: chemMyData.myList || [],
      compound_stats: chemMyData.stats || {},
      daily_stats: chemMyData.dailyStats || {},
      updated_at: new Date().toISOString()
    };
  }

  function chemEnsureSupabase() {
    if (!chemSupabase && window.supabase) {
      chemSupabase = window.supabase.createClient(CHEM_SUPABASE_URL, CHEM_SUPABASE_KEY);
    }
    return chemSupabase;
  }

  function chemFallbackCompounds() {
    return [
      { name: "Ethanol", smiles: "CCO", tags: ["reagent"] },
      { name: "Caffeine", smiles: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C", tags: ["organic"] },
      { name: "Aspirin", smiles: "CC(=O)Oc1ccccc1C(=O)O", tags: ["acid", "aromatic"] },
      { name: "Glucose", smiles: "OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O", tags: ["organic"] },
      { name: "Benzene", smiles: "c1ccccc1", tags: ["aromatic"] },
      { name: "Acetic Acid", smiles: "CC(=O)O", tags: ["acid"] },
      { name: "Acetone", smiles: "CC(C)=O", tags: ["reagent"] },
      { name: "Methanol", smiles: "CO", tags: ["reagent"] },
      { name: "Toluene", smiles: "Cc1ccccc1", tags: ["aromatic"] },
      { name: "Phenol", smiles: "Oc1ccccc1", tags: ["acid", "aromatic"] }
    ];
  }

  async function chemInitApp() {
    if (chemAppReady) {
      chemUpdateDashboard();
      chemLoadLeaderboard('today');
      return;
    }

    chemEnsureDailyStats();
    chemEnsureSupabase();

    try {
      const options = {
        width: 520,
        height: 300,
        bondThickness: 1.8,
        fontSizeLarge: 14,
        themes: {
          dark: {
            C: '#e8eaf6',
            O: '#ef4444',
            N: '#5f8dff',
            S: '#f59e0b',
            H: '#94a3b8',
            P: '#22c55e',
            F: '#22c55e',
            Cl: '#22c55e',
            Br: '#f59e0b',
            I: '#8b5cf6',
            BACKGROUND: '#121b31'
          }
        }
      };
      if (typeof SmiDrawer !== 'undefined') chemDrawer = new SmiDrawer(options);
      else if (typeof SmilesDrawer !== 'undefined') chemDrawer = new SmilesDrawer.SmiDrawer(options);
    } catch (err) {
      console.warn('Chem drawer init failed', err);
    }

    try {
      const response = await fetch('compounds_smiles.json');
      if (!response.ok) throw new Error('No compound JSON');
      const loaded = await response.json();
      chemAllCompounds = Array.isArray(loaded) && loaded.length ? loaded : chemFallbackCompounds();
    } catch (_) {
      chemAllCompounds = chemFallbackCompounds();
    }

    chemAppReady = true;
    chemUpdateDashboard();
    chemLoadLeaderboard('today');
  }

  function chemUpdateDashboard() {
    const total = chemAllCompounds.length;
    const inList = chemMyData.myList.length;
    const mastered = chemMyData.myList.filter(name => {
      const s = chemMyData.stats[name];
      return s && s.correct >= 5 && s.wrong === 0;
    }).length;

    // Calculate today's and 7-day attempts
    const today = chemTodayKey();
    const todayAttempts = chemMyData.dailyStats[today]?.attempted || 0;

    let sevenDayAttempts = 0;
    const recentStart = chemRecentStartKey(7);
    if (chemMyData.dailyStats && typeof chemMyData.dailyStats === 'object') {
      for (const [date, stats] of Object.entries(chemMyData.dailyStats)) {
        if (date >= recentStart && stats) {
          sevenDayAttempts += stats.attempted || 0;
        }
      }
    }

    const list = document.getElementById('chem-stat-list');
    const totalEl = document.getElementById('chem-stat-total');
    const masteredEl = document.getElementById('chem-stat-mastered');
    const todayAttemptsEl = document.getElementById('chem-stat-today-attempts');
    const sevenDayAttemptsEl = document.getElementById('chem-stat-7day-attempts');

    if (list) list.innerHTML = `List: <strong>${inList}</strong>`;
    if (totalEl) totalEl.innerHTML = `Total: <strong>${total}</strong>`;
    if (masteredEl) masteredEl.innerHTML = `Mastered: <strong>${mastered}</strong>`;
    if (todayAttemptsEl) todayAttemptsEl.innerHTML = `Today: <strong>${todayAttempts}</strong>`;
    if (sevenDayAttemptsEl) sevenDayAttemptsEl.innerHTML = `7-Day: <strong>${sevenDayAttempts}</strong>`;
  }

  function chemSave() {
    chemEnsureDailyStats();
    localStorage.setItem(CHEM_DATA_KEY, JSON.stringify(chemMyData));
    localStorage.setItem('chem_progress_updated_at', new Date().toISOString());
    chemUpdateDashboard();
  }

  function chemDrawStructure(smiles, canvasId) {
    if (!smiles) return;
    const renderer = localStorage.getItem('chem_setting_renderer') || 'smiles';
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (renderer === 'rdkit') {
      canvas.classList.add('rdkit-canvas');

      if (window.RDKitModule) {
        try {
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

          const mol = window.RDKitModule.get_mol(smiles);
          if (mol) {
            const drawOpts = {
              backgroundColour: [1, 1, 1, 1],
              legendColour: [0, 0, 0, 1],
              symbolColour: [0, 0, 0, 1]
            };
            mol.draw_to_canvas_with_highlights(canvas, JSON.stringify(drawOpts));
            mol.delete();
          }
        } catch (err) {
          console.warn('RDKit draw failed', err);
          drawWithSmilesDrawer(smiles, canvasId);
        }
      } else {
        loadRDKitDynamic().then(() => {
          chemDrawStructure(smiles, canvasId);
        }).catch(() => {
          drawWithSmilesDrawer(smiles, canvasId);
        });
      }
    } else {
      canvas.classList.remove('rdkit-canvas');
      drawWithSmilesDrawer(smiles, canvasId);
    }
  }

  function drawWithSmilesDrawer(smiles, canvasId) {
    if (!chemDrawer) return;
    try {
      try { chemDrawer.draw(smiles, '#' + canvasId, 'dark'); }
      catch (_) { chemDrawer.draw(smiles, '#' + canvasId, 'light'); }
    } catch (err) {
      console.warn('Smiles drawer draw failed', err);
    }
  }

  let rdkitLoadingPromise = null;
  function loadRDKitDynamic() {
    if (window.RDKitModule) return Promise.resolve(window.RDKitModule);
    if (rdkitLoadingPromise) return rdkitLoadingPromise;

    rdkitLoadingPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = "https://unpkg.com/@rdkit/rdkit/dist/RDKit_minimal.js";
      script.onload = () => {
        if (typeof initRDKitModule !== 'undefined') {
          initRDKitModule()
            .then((instance) => {
              window.RDKitModule = instance;
              console.log("RDKit loaded, version:", instance.version());
              resolve(instance);
            })
            .catch((err) => {
              console.error("RDKit init failed:", err);
              reject(err);
            });
        } else {
          reject(new Error("initRDKitModule not defined after script load"));
        }
      };
      script.onerror = (err) => {
        console.error("RDKit script load failed:", err);
        reject(err);
      };
      document.head.appendChild(script);
    });

    return rdkitLoadingPromise;
  }

  function chemRefreshCurrentDrawing() {
    const activeView = document.querySelector('.chem-view.active');
    if (!activeView) return;
    if (activeView.id === 'chem-view-learn') {
      chemUpdateLearnCard();
    } else if (activeView.id === 'chem-view-practice') {
      const wizardMode = localStorage.getItem('chem_setting_wizard_mode') === 'true';
      if (wizardMode) {
        if (chemWizardQueue.length > 0 && chemWizardIdx < chemWizardQueue.length) {
          const targetName = chemWizardQueue[chemWizardIdx];
          const canvasWrap = document.querySelector('#chem-view-practice .chem-canvas-wrap');
          if (canvasWrap && canvasWrap.style.display !== 'none') {
            const targetObj = chemAllCompounds.find(c => c.name === targetName);
            if (targetObj) chemDrawStructure(targetObj.smiles, 'chem-practice-canvas');
          }
        }
      } else {
        if (chemLastPracticeName) {
          const targetObj = chemAllCompounds.find(c => c.name === chemLastPracticeName);
          if (targetObj) {
            const canvasWrap = document.querySelector('#chem-view-practice .chem-canvas-wrap');
            if (canvasWrap && canvasWrap.style.display !== 'none') {
              chemDrawStructure(targetObj.smiles, 'chem-practice-canvas');
            } else {
              const btns = document.querySelectorAll('.chem-opt-btn-structure');
              btns.forEach((btn, i) => {
                const optVal = btn.dataset.option;
                const optObj = chemAllCompounds.find(c => c.name === optVal);
                if (optObj) {
                  chemDrawStructure(optObj.smiles, `chem-opt-canvas-${i}`);
                }
              });
            }
          }
        }
      }
    }
  }

  function chemBuildLearnQueue() {
    const names = [...chemMyData.myList];
    const weighted = names.map(name => {
      const s = chemMyData.stats[name] || { correct: 0, wrong: 0, streak: 0, lastSeen: 0 };
      const hrsSince = (Date.now() - (s.lastSeen || 0)) / 3600000;
      const errorRatio = (s.wrong + 1) / (s.correct + 2);
      const staleness = Math.min(hrsSince / 24, 3);
      const streakPenalty = Math.max(0, 1 - s.streak * 0.1);
      const weight = (errorRatio * 4) + (staleness * 2) + streakPenalty + (Math.random() * 1.5);
      return { name, weight };
    });
    weighted.sort((a, b) => b.weight - a.weight);
    return weighted.map(w => w.name);
  }

  function chemShowView(id) {
    document.querySelectorAll('.chem-view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById('chem-view-' + id);
    if (view) view.classList.add('active');
  }

  function chemGoHome() {
    chemShowView('home');
    chemSyncAll(false);
  }

  function chemLearnNew() {
    if (!chemAppReady) return chemInitApp().then(chemLearnNew);
    const remaining = chemAllCompounds.filter(c => !chemMyData.myList.includes(c.name));
    if (!remaining.length) {
      chemShowToast("All available compounds are already in your list.");
      return;
    }
    const selected = remaining.sort(() => 0.5 - Math.random()).slice(0, Math.min(5, remaining.length));
    selected.forEach(c => {
      chemMyData.myList.push(c.name);
      chemMyData.stats[c.name] = { wrong: 0, correct: 0, streak: 0, lastSeen: 0 };
    });
    chemSave();
    chemSyncAll(false);
    chemShowToast(`Added: ${selected.map(s => s.name).join(', ')}`);
  }

  async function chemInitLearn() {
    if (!chemMyData.myList.length) {
      chemShowToast("Add compounds first.");
      return;
    }
    chemLearnQueue = chemBuildLearnQueue();
    chemLearnIdx = 0;
    chemShowView('learn');
    chemUpdateLearnCard();
  }

  function chemChangeLearn(dir) {
    if (!chemLearnQueue.length) return;
    chemLearnIdx += dir;
    if (chemLearnIdx >= chemLearnQueue.length) chemLearnIdx = 0;
    if (chemLearnIdx < 0) chemLearnIdx = chemLearnQueue.length - 1;
    chemUpdateLearnCard();
  }

  function chemUpdateLearnCard() {
    const name = chemLearnQueue[chemLearnIdx];
    const comp = chemAllCompounds.find(c => c.name === name);
    const stat = chemMyData.stats[name] || { correct: 0, wrong: 0, streak: 0 };

    document.getElementById('chem-learn-name').textContent = name || '-';
    document.getElementById('chem-learn-index-text').textContent = `${chemLearnIdx + 1} / ${chemLearnQueue.length}`;
    document.getElementById('chem-learn-correct').textContent = stat.correct || 0;
    document.getElementById('chem-learn-wrong').textContent = stat.wrong || 0;
    document.getElementById('chem-learn-streak').textContent = stat.streak || 0;
    document.getElementById('chem-learn-progress').style.width = `${((chemLearnIdx + 1) / chemLearnQueue.length * 100).toFixed(1)}%`;
    if (comp) chemDrawStructure(comp.smiles, 'chem-learn-canvas');
  }

  function chemSampleWeighted(names) {
    const scored = names.map(name => {
      const s = chemMyData.stats[name] || { correct: 0, wrong: 0, streak: 0, lastSeen: 0 };
      const hrsSince = (Date.now() - (s.lastSeen || 0)) / 3600000;
      const weight = (s.wrong * 4) + Math.min(hrsSince * 0.6, 12) - (s.streak * 2) + (Math.random() * 8);
      return { name, weight };
    });
    const totalWeight = scored.reduce((sum, s) => sum + Math.max(s.weight, 0.5), 0);
    let rand = Math.random() * totalWeight;
    for (const item of scored.sort((a, b) => b.weight - a.weight)) {
      rand -= Math.max(item.weight, 0.5);
      if (rand <= 0) return item.name;
    }
    return scored[0]?.name;
  }

  async function chemInitPractice() {
    const wizardMode = localStorage.getItem('chem_setting_wizard_mode') === 'true';
    if (wizardMode) {
      if (!chemMyData.myList || chemMyData.myList.length === 0) {
        chemShowToast("Add compounds first.");
        return;
      }
      chemPracticeSessionCount = 0;
      chemPracticeCorrectCount = 0;
      chemWizardQueue = [...chemMyData.myList].sort(() => 0.5 - Math.random());
      chemWizardIdx = 0;
      chemShowView('practice');
      chemWizardNextQuestion();
      return;
    }

    if (chemMyData.myList.length < 4) {
      chemShowToast("Need at least 4 compounds in your list.");
      return;
    }
    chemPracticeSessionCount = 0;
    chemPracticeCorrectCount = 0;
    chemLastPracticeName = null;
    chemShowView('practice');
    chemNextQuestion();
  }

  // ── Generous Spell Check Helper ──────────────────────────────────────────
  function levenshteinDistance(s1, s2) {
    s1 = s1.toLowerCase().trim();
    s2 = s2.toLowerCase().trim();
    if (s1 === s2) return 0;
    if (s1.length === 0) return s2.length;
    if (s2.length === 0) return s1.length;
    
    const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;
    
    for (let j = 1; j <= s2.length; j += 1) {
      for (let i = 1; i <= s1.length; i += 1) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1, // deletion
          track[j - 1][i] + 1, // insertion
          track[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    return track[s2.length][s1.length];
  }

  function isSpellCheckedCorrect(userVal, correctVal) {
    // Strip hyphens, spaces, commas, brackets, and other non-alphanumeric chars
    const cleanUser = userVal.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const cleanCorrect = correctVal.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    
    if (cleanUser === cleanCorrect) return true;
    
    // Ensure user typed at least half the characters of the correct answer
    const minLen = Math.ceil(cleanCorrect.length / 2);
    if (cleanUser.length < minLen) return false;
    
    const dist = levenshteinDistance(cleanUser, cleanCorrect);
    const len = cleanCorrect.length;
    
    // Extremely generous spell checking edit distance thresholds:
    if (len <= 4) return dist <= 2;
    if (len <= 8) return dist <= 3;
    if (len <= 12) return dist <= 4;
    return dist <= 5;
  }

  // ── Tag-Weighted & Name-Similarity Distractor Sampler ──────────────────────
  function chemGetWeightedDistractors(targetObj, count) {
    const pool = chemAllCompounds.filter(c => c.name !== targetObj.name);
    const selected = [];
    let candidates = pool.map(c => {
      const targetTags = targetObj.tags || [];
      const candidateTags = c.tags || [];
      const sharedCount = candidateTags.filter(t => targetTags.includes(t)).length;
      
      let weight = 1.0 + sharedCount * 6.0;

      // Name similarity weight boost (e.g. Ethanol and Methanol, abcde and abbde)
      const name1 = targetObj.name.toLowerCase().trim();
      const name2 = c.name.toLowerCase().trim();
      const dist = levenshteinDistance(name1, name2);
      const maxLen = Math.max(name1.length, name2.length);
      const similarity = maxLen > 0 ? (maxLen - dist) / maxLen : 0;

      // Apply similarity boost for candidates with similar spelling (similarity >= 0.4)
      if (similarity >= 0.4) {
        weight += Math.pow(similarity, 2) * 15.0;
      }

      return { item: c, weight };
    });
    
    for (let step = 0; step < count; step++) {
      if (candidates.length === 0) break;
      const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
      let r = Math.random() * totalWeight;
      let chosenIndex = 0;
      for (let i = 0; i < candidates.length; i++) {
        r -= candidates[i].weight;
        if (r <= 0) {
          chosenIndex = i;
          break;
        }
      }
      selected.push(candidates[chosenIndex].item);
      candidates.splice(chosenIndex, 1);
    }
    return selected;
  }

  function chemNextQuestion() {
    const textModeSetting = localStorage.getItem('chem_setting_text_mode') !== 'false';
    const masteredList = textModeSetting 
      ? chemMyData.myList.filter(name => {
          const s = chemMyData.stats[name];
          // Mastered if correct >= 5 and wrong === 0, and name length <= 20
          return s && s.correct >= 5 && s.wrong === 0 && name.length <= 20;
        })
      : [];

    let mode = 'normal'; // 'normal' | 'reverse' | 'text'
    const roll = Math.random();
    if (roll < 0.20 && masteredList.length > 0) {
      mode = 'text';
    } else {
      mode = Math.random() < 0.40 ? 'reverse' : 'normal';
    }

    const optionsDiv = document.getElementById('chem-practice-options');
    optionsDiv.innerHTML = '';
    
    // Default class list and display resets
    optionsDiv.className = 'chem-options-grid';

    const canvasWrap = document.querySelector('#chem-view-practice .chem-canvas-wrap');
    if (canvasWrap) canvasWrap.style.display = 'flex';

    if (mode === 'text') {
      // 1. Text input mode
      const eligibleMastered = masteredList.filter(n => n !== chemLastPracticeName);
      const targetName = eligibleMastered.length > 0
        ? eligibleMastered[Math.floor(Math.random() * eligibleMastered.length)]
        : masteredList[Math.floor(Math.random() * masteredList.length)];
      chemLastPracticeName = targetName;
      const targetObj = chemAllCompounds.find(c => c.name === targetName);
      if (!targetObj) return;

      chemDrawStructure(targetObj.smiles, 'chem-practice-canvas');
      document.getElementById('chem-practice-hint').textContent = 'Type the name of this compound';

      optionsDiv.innerHTML = `
        <div style="width: 100%; display: flex; flex-direction: column; gap: 12px; margin-top: 10px; grid-column: span 2;">
          <input type="text" id="chem-practice-text-input" placeholder="Type compound name..." style="width: 100%; padding: 12px 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg3); color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color 0.2s;" autocomplete="off" />
          <button class="chem-btn chem-btn-primary" id="chem-practice-text-submit" style="width: 100%; height: 42px; font-size: 14px; font-weight: 700; border-radius: 10px; cursor: pointer;">Submit</button>
        </div>
      `;

      const txtInput = document.getElementById('chem-practice-text-input');
      const submitBtn = document.getElementById('chem-practice-text-submit');
      
      txtInput.onfocus = () => { txtInput.style.borderColor = 'var(--accent)'; };
      txtInput.onblur = () => { txtInput.style.borderColor = 'var(--border)'; };

      const handleSubmit = () => {
        const val = txtInput.value;
        chemHandleTextAnswer(val, targetName);
      };

      submitBtn.onclick = handleSubmit;
      txtInput.onkeydown = (e) => {
        if (e.key === 'Enter') handleSubmit();
      };

      setTimeout(() => txtInput.focus(), 100);

    } else if (mode === 'reverse') {
      // 2. Reverse MCQ: Name to structure
      const eligible = chemMyData.myList.filter(n => n !== chemLastPracticeName);
      const targetName = chemSampleWeighted(eligible.length >= 4 ? eligible : chemMyData.myList);
      chemLastPracticeName = targetName;
      const targetObj = chemAllCompounds.find(c => c.name === targetName);
      if (!targetObj) return;

      // Hide main structure canvas
      if (canvasWrap) canvasWrap.style.display = 'none';
      document.getElementById('chem-practice-hint').innerHTML = `Identify structure for: <strong style="color:var(--accent); font-weight:700;">${escapeHtml(targetName)}</strong>`;

      const distractorArr = chemGetWeightedDistractors(targetObj, 1);
      const distractorObj = distractorArr[0] || chemAllCompounds.find(c => c.name !== targetName);
      
      const options = [targetObj, distractorObj].sort(() => 0.5 - Math.random());
      const letters = ['A', 'B'];

      optionsDiv.classList.add('chem-reverse-layout');

      options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'chem-opt-btn-structure';
        btn.dataset.option = opt.name;
        btn.innerHTML = `
          <span class="chem-opt-letter" style="position: absolute; top: 10px; left: 10px;">${letters[i]}</span>
          <canvas id="chem-opt-canvas-${i}" style="width: 100%; height: 120px;"></canvas>
        `;
        btn.onclick = () => chemHandleAnswer(opt.name, targetName);
        optionsDiv.appendChild(btn);
        
        // Draw inside options canvases
        setTimeout(() => {
          chemDrawStructure(opt.smiles, `chem-opt-canvas-${i}`);
        }, 0);
      });

    } else {
      // 3. Normal MCQ: Structure to name
      const eligible = chemMyData.myList.filter(n => n !== chemLastPracticeName);
      const targetName = chemSampleWeighted(eligible.length >= 4 ? eligible : chemMyData.myList);
      chemLastPracticeName = targetName;
      const targetObj = chemAllCompounds.find(c => c.name === targetName);
      if (!targetObj) return;

      chemDrawStructure(targetObj.smiles, 'chem-practice-canvas');
      document.getElementById('chem-practice-hint').textContent = 'Identify the compound';

      const distractorObjs = chemGetWeightedDistractors(targetObj, 3);
      const distractors = distractorObjs.map(c => c.name);
      
      const options = [targetName, ...distractors].sort(() => 0.5 - Math.random());
      const letters = ['A', 'B', 'C', 'D'];

      options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'chem-opt-btn';
        btn.dataset.option = opt;
        btn.innerHTML = `<span class="chem-opt-letter">${letters[i]}</span><span>${escapeHtml(opt)}</span>`;
        btn.onclick = () => chemHandleAnswer(opt, targetName);
        optionsDiv.appendChild(btn);
      });
    }

  }

  function chemHandleAnswer(chosen, correct) {
    const btns = document.querySelectorAll('.chem-opt-btn, .chem-opt-btn-structure');
    btns.forEach(b => b.disabled = true);

    chemEnsureDailyStats();
    const today = chemTodayKey();
    if (!chemMyData.dailyStats[today]) {
      chemMyData.dailyStats[today] = { correct: 0, wrong: 0, attempted: 0, timeSpent: 0 };
    }
    if (!chemMyData.stats[correct]) {
      chemMyData.stats[correct] = { wrong: 0, correct: 0, streak: 0, lastSeen: 0 };
    }

    chemPracticeSessionCount++;
    const isCorrect = chosen === correct;
    chemMyData.dailyStats[today].attempted = (chemMyData.dailyStats[today].attempted || 0) + 1;

    if (isCorrect) {
      chemMyData.dailyStats[today].correct = (chemMyData.dailyStats[today].correct || 0) + 1;
      chemPracticeCorrectCount++;
      chemMyData.stats[correct].correct = (chemMyData.stats[correct].correct || 0) + 1;
      chemMyData.stats[correct].streak = (chemMyData.stats[correct].streak || 0) + 1;
      chemShowFlash('Correct', false);
    } else {
      chemMyData.dailyStats[today].wrong = (chemMyData.dailyStats[today].wrong || 0) + 1;
      chemMyData.stats[correct].wrong = (chemMyData.stats[correct].wrong || 0) + 1;
      chemMyData.stats[correct].streak = 0;
      chemShowFlash('Wrong', true);
    }

    chemMyData.stats[correct].lastSeen = Date.now();
    chemSave();
    chemSyncAll(false);

    btns.forEach(b => {
      const optVal = b.dataset.option || b.innerText.replace(/^[A-D]/, '').trim();
      if (optVal === correct) b.classList.add(isCorrect ? 'correct' : 'reveal');
      if (optVal === chosen && !isCorrect) b.classList.add('wrong');
    });

    document.getElementById('chem-practice-hint').textContent = isCorrect ? "That's right" : `It was: ${correct}`;
    setTimeout(chemNextQuestion, isCorrect ? 1200 : 1800);
  }

  function chemHandleTextAnswer(chosen, correct) {
    const txtInput = document.getElementById('chem-practice-text-input');
    const submitBtn = document.getElementById('chem-practice-text-submit');
    if (txtInput) txtInput.disabled = true;
    if (submitBtn) submitBtn.disabled = true;

    chemEnsureDailyStats();
    const today = chemTodayKey();
    if (!chemMyData.dailyStats[today]) {
      chemMyData.dailyStats[today] = { correct: 0, wrong: 0, attempted: 0, timeSpent: 0 };
    }
    if (!chemMyData.stats[correct]) {
      chemMyData.stats[correct] = { wrong: 0, correct: 0, streak: 0, lastSeen: 0 };
    }

    chemPracticeSessionCount++;
    const isCorrect = isSpellCheckedCorrect(chosen, correct);
    chemMyData.dailyStats[today].attempted = (chemMyData.dailyStats[today].attempted || 0) + 1;

    if (isCorrect) {
      chemMyData.dailyStats[today].correct = (chemMyData.dailyStats[today].correct || 0) + 1;
      chemPracticeCorrectCount++;
      chemMyData.stats[correct].correct = (chemMyData.stats[correct].correct || 0) + 1;
      chemMyData.stats[correct].streak = (chemMyData.stats[correct].streak || 0) + 1;
      
      const exactMatch = chosen.toLowerCase().trim().replace(/[^a-z0-9]/g, '') === correct.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      if (exactMatch) {
        chemShowFlash('Correct', false);
      } else {
        chemShowFlash(`Correct (Spelled: ${correct})`, false);
      }
    } else {
      chemMyData.dailyStats[today].wrong = (chemMyData.dailyStats[today].wrong || 0) + 1;
      chemMyData.stats[correct].wrong = (chemMyData.stats[correct].wrong || 0) + 1;
      chemMyData.stats[correct].streak = 0;
      chemShowFlash('Wrong', true);
    }

    chemMyData.stats[correct].lastSeen = Date.now();
    chemSave();
    chemSyncAll(false);

    if (txtInput) {
      txtInput.style.borderColor = isCorrect ? '#22c55e' : '#ef4444';
      txtInput.style.background = isCorrect ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';
      txtInput.style.color = isCorrect ? '#22c55e' : '#ef4444';
    }

    document.getElementById('chem-practice-hint').textContent = isCorrect ? "That's right" : `It was: ${correct}`;
    setTimeout(chemNextQuestion, isCorrect ? 1200 : 1800);
  }

  function chemWizardNextQuestion() {
    if (chemWizardIdx >= chemWizardQueue.length) {
      chemWizardShowCompleted();
      return;
    }

    const targetName = chemWizardQueue[chemWizardIdx];
    const canvasWrap = document.querySelector('#chem-view-practice .chem-canvas-wrap');
    if (canvasWrap) canvasWrap.style.display = 'none';

    document.getElementById('chem-practice-hint').innerHTML = `Draw structure for: <strong style="color:var(--accent); font-size:16px; font-weight:700;">${escapeHtml(targetName)}</strong>`;

    const optionsDiv = document.getElementById('chem-practice-options');
    optionsDiv.className = 'chem-options-grid';
    optionsDiv.innerHTML = `
      <div style="width: 100%; display: flex; flex-direction: column; gap: 12px; margin-top: 10px; grid-column: span 2;">
        <button class="chem-btn chem-btn-primary" id="chem-wizard-done-btn" style="width: 100%; height: 50px; font-size: 16px; font-weight: 700; border-radius: 10px; cursor: pointer;">Done</button>
      </div>
    `;

    document.getElementById('chem-wizard-done-btn').onclick = () => {
      chemWizardRevealStructure(targetName);
    };
  }

  function chemWizardRevealStructure(targetName) {
    const canvasWrap = document.querySelector('#chem-view-practice .chem-canvas-wrap');
    if (canvasWrap) canvasWrap.style.display = 'flex';

    const targetObj = chemAllCompounds.find(c => c.name === targetName);
    if (targetObj) {
      chemDrawStructure(targetObj.smiles, 'chem-practice-canvas');
    }

    document.getElementById('chem-practice-hint').innerHTML = `Structure for: <strong style="color:var(--accent); font-size:16px; font-weight:700;">${escapeHtml(targetName)}</strong>`;

    const optionsDiv = document.getElementById('chem-practice-options');
    optionsDiv.innerHTML = `
      <div style="width: 100%; display: flex; flex-direction: column; align-items: center; gap: 14px; margin-top: 10px; grid-column: span 2;">
        <div style="font-size: 14px; font-weight: 500; color: var(--text2);">My structure was...</div>
        <div style="display: flex; width: 100%; gap: 12px;">
          <button class="chem-btn" id="chem-wizard-correct-btn" style="flex: 1; height: 50px; font-size: 15px; font-weight: 700; border-radius: 10px; cursor: pointer; background: rgba(34,197,94,0.15); border: 2px solid #22c55e; color: #22c55e;">Correct</button>
          <button class="chem-btn" id="chem-wizard-wrong-btn" style="flex: 1; height: 50px; font-size: 15px; font-weight: 700; border-radius: 10px; cursor: pointer; background: rgba(239,68,68,0.15); border: 2px solid #ef4444; color: #ef4444;">Wrong</button>
        </div>
      </div>
    `;

    document.getElementById('chem-wizard-correct-btn').onclick = () => {
      chemWizardSubmitAnswer(targetName, true);
    };
    document.getElementById('chem-wizard-wrong-btn').onclick = () => {
      chemWizardSubmitAnswer(targetName, false);
    };
  }

  function chemWizardSubmitAnswer(targetName, isCorrect) {
    const correctBtn = document.getElementById('chem-wizard-correct-btn');
    const wrongBtn = document.getElementById('chem-wizard-wrong-btn');
    if (correctBtn) correctBtn.disabled = true;
    if (wrongBtn) wrongBtn.disabled = true;

    chemEnsureDailyStats();
    const today = chemTodayKey();
    if (!chemMyData.dailyStats[today]) {
      chemMyData.dailyStats[today] = { correct: 0, wrong: 0, attempted: 0, timeSpent: 0 };
    }
    if (!chemMyData.stats[targetName]) {
      chemMyData.stats[targetName] = { wrong: 0, correct: 0, streak: 0, lastSeen: 0 };
    }

    chemPracticeSessionCount++;
    chemMyData.dailyStats[today].attempted = (chemMyData.dailyStats[today].attempted || 0) + 1;

    if (isCorrect) {
      chemMyData.dailyStats[today].correct = (chemMyData.dailyStats[today].correct || 0) + 1;
      chemPracticeCorrectCount++;
      chemMyData.stats[targetName].correct = (chemMyData.stats[targetName].correct || 0) + 1;
      chemMyData.stats[targetName].streak = (chemMyData.stats[targetName].streak || 0) + 1;
      chemShowFlash('Correct', false);
    } else {
      chemMyData.dailyStats[today].wrong = (chemMyData.dailyStats[today].wrong || 0) + 1;
      chemMyData.stats[targetName].wrong = (chemMyData.stats[targetName].wrong || 0) + 1;
      chemMyData.stats[targetName].streak = 0;
      chemShowFlash('Wrong', true);
    }

    chemMyData.stats[targetName].lastSeen = Date.now();
    chemSave();
    chemSyncAll(false);

    chemWizardIdx++;
    setTimeout(chemWizardNextQuestion, 1000);
  }

  function chemWizardShowCompleted() {
    const canvasWrap = document.querySelector('#chem-view-practice .chem-canvas-wrap');
    if (canvasWrap) canvasWrap.style.display = 'none';

    document.getElementById('chem-practice-hint').innerHTML = `<span style="font-size: 20px; font-weight: 700; color: var(--accent);">Run Complete!</span>`;

    const optionsDiv = document.getElementById('chem-practice-options');
    const percent = chemPracticeSessionCount > 0 ? Math.round((chemPracticeCorrectCount / chemPracticeSessionCount) * 100) : 0;
    
    optionsDiv.innerHTML = `
      <div style="width: 100%; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 20px 10px; grid-column: span 2; text-align: center;">
        <div style="font-size: 48px; font-weight: 800; color: var(--accent); margin-bottom: 8px;">${percent}%</div>
        <div style="font-size: 15px; font-weight: 500; color: var(--text2);">You got <strong>${chemPracticeCorrectCount}</strong> out of <strong>${chemPracticeSessionCount}</strong> compounds correct!</div>
        <div style="font-size: 12px; color: var(--text3); max-width: 300px;">Every compound in your list was tested exactly once without repetition.</div>
        <button class="chem-btn chem-btn-primary" onclick="chemGoHome()" style="width: 100%; max-width: 240px; height: 42px; font-size: 14px; font-weight: 700; border-radius: 8px; margin-top: 10px; cursor: pointer;">Back to Menu</button>
      </div>
    `;
  }

  async function chemSyncAll(showFeedback = false) {
    if (!chemAppReady) return false;

    chemSyncQueue = chemSyncQueue.catch(() => {}).then(async () => {
      const client = chemEnsureSupabase();
      if (!client) {
        if (showFeedback) chemShowToast("Leaderboard offline.");
        return false;
      }

      const userId = chemCurrentUserName();
      let failed = false;

      // 1. Sync Progress (chem_user_progress)
      try {
        const { data: existing, error: lookupError } = await client
          .from('chem_user_progress')
          .select('my_list,compound_stats,daily_stats,updated_at')
          .eq('user_id', userId)
          .maybeSingle();

        if (lookupError) {
          console.error("Progress sync error:", lookupError);
          failed = true;
        } else {
          let shouldUpload = true;
          if (existing) {
            const localProgress = chemNormalizeProgressData(chemMyData);
            const cloudProgress = chemNormalizeProgressData({
              myList: existing.my_list,
              stats: existing.compound_stats,
              dailyStats: existing.daily_stats
            });
            const localAttempted = chemProgressAttemptedTotal(localProgress);
            const cloudAttempted = chemProgressAttemptedTotal(cloudProgress);

            if (cloudAttempted > localAttempted) {
              chemMyData = cloudProgress;
              chemEnsureDailyStats();
              localStorage.setItem(CHEM_DATA_KEY, JSON.stringify(chemMyData));
              if (existing.updated_at) localStorage.setItem('chem_progress_updated_at', existing.updated_at);
              shouldUpload = false;
            }
          }

          if (shouldUpload) {
            const payload = chemBuildProgressPayload();
            const { error: uploadError } = await client
              .from('chem_user_progress')
              .upsert(payload, { onConflict: 'user_id' });

            if (uploadError) {
              console.error("Progress upload error:", uploadError);
              failed = true;
            } else if (payload.updated_at) {
              localStorage.setItem('chem_progress_updated_at', payload.updated_at);
            }
          }
        }
      } catch (err) {
        console.error("Progress sync exception:", err);
        failed = true;
      }

      // 2. Sync Leaderboard Stats (leaderboard_stats)
      try {
        const recentStart = chemRecentStartKey(7);
        const dailyEntries = Object.entries(chemMyData.dailyStats || {})
          .filter(([date, stats]) => date >= recentStart && stats && Number(stats.attempted || 0) > 0)
          .sort(([a], [b]) => a.localeCompare(b));

        for (const [statDate, stats] of dailyEntries) {
          const payload = chemBuildDailyPayload(statDate, stats);
          const { error: upsertError } = await client
            .from('leaderboard_stats')
            .upsert(payload, { onConflict: 'user_id,stat_date' });

          if (upsertError) {
            console.error("Leaderboard upsert error:", upsertError);
            failed = true;
          }
        }
      } catch (err) {
        console.error("Leaderboard sync exception:", err);
        failed = true;
      }

      // 3. UI Updates
      if (showFeedback) {
        if (failed) chemShowToast("Some cloud stats failed.");
        else chemShowToast("Stats uploaded.");
      }

      if (!failed) {
        chemLoadLeaderboard(document.getElementById('chem-board-week')?.classList.contains('active') ? 'week' : 'today');
      }

      return !failed;
    });

    return chemSyncQueue;
  }

  async function chemDownloadProgress(force = false) {
    const client = chemEnsureSupabase();
    if (!client || !navigator.onLine) return false;

    const userId = chemCurrentUserName();
    const { data, error } = await client
      .from('chem_user_progress')
      .select('my_list,compound_stats,daily_stats,updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error(error);
      return false;
    }
    if (!data) return false;

    const localProgress = chemNormalizeProgressData(chemMyData);
    const cloudProgress = chemNormalizeProgressData({
      myList: data.my_list,
      stats: data.compound_stats,
      dailyStats: data.daily_stats
    });
    const localAttempted = chemProgressAttemptedTotal(localProgress);
    const cloudAttempted = chemProgressAttemptedTotal(cloudProgress);

    if (cloudAttempted > localAttempted || force) {
      chemMyData = cloudProgress;
      chemEnsureDailyStats();
      localStorage.setItem(CHEM_DATA_KEY, JSON.stringify(chemMyData));
      if (data.updated_at) localStorage.setItem('chem_progress_updated_at', data.updated_at);
      else localStorage.setItem('chem_progress_updated_at', new Date().toISOString());
      return true;
    }
    return false;
  }

  window.syncCloudProgress = async function syncCloudProgress() {
    setSyncPill(navigator.onLine ? 'live' : 'offline', navigator.onLine ? 'Syncing cloud...' : 'Offline');
    if (!navigator.onLine) {
      chemShowToast("You are offline.");
      return;
    }

    chemEnsureDailyStats();
    try {
      const synced = await chemSyncAll(true);
      if (!synced) throw new Error('Cloud sync failed');
      chemUpdateDashboard();
      setSyncPill('live', 'Cloud synced');
    } catch (err) {
      console.error(err);
      setSyncPill('offline', 'Cloud sync failed');
    }
  };

  async function chemLoadLeaderboard(period = 'today') {
    const client = chemEnsureSupabase();
    const list = document.getElementById('chem-leaderboard-list');
    if (!list) return;
    if (!client) {
      list.innerHTML = '<div class="empty">Leaderboard unavailable (offline or connection blocked).</div>';
      return;
    }

    document.getElementById('chem-board-today')?.classList.toggle('active', period === 'today');
    document.getElementById('chem-board-week')?.classList.toggle('active', period === 'week');
    list.innerHTML = '<div class="empty">Loading leaderboard...</div>';

    const startDate = period === 'week' ? chemRecentStartKey(7) : chemTodayKey();
    let query = client
      .from('leaderboard_stats')
      .select('user_id,username,stat_date,correct,wrong,attempted,time_spent,updated_at');

    if (period === 'today') {
      query = query.eq('stat_date', startDate);
    } else {
      query = query.gte('stat_date', startDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error(error);
      list.innerHTML = '<div class="empty">Could not load leaderboard.</div>';
      return;
    }

    const rows = Object.values((data || []).reduce((acc, row) => {
      const key = row.user_id || row.username || 'unknown';
      if (!acc[key]) {
        acc[key] = {
          user_id: key,
          username: row.username || key,
          correct: 0,
          wrong: 0,
          attempted: 0,
          time_spent: 0
        };
      }
      acc[key].correct += Number(row.correct || 0);
      acc[key].wrong += Number(row.wrong || 0);
      acc[key].attempted += Number(row.attempted || 0);
      acc[key].time_spent += Number(row.time_spent || 0);
      return acc;
    }, {})).sort((a, b) => (b.correct - a.correct) || (b.attempted - a.attempted)).slice(0, 30);

    if (!rows.length) {
      list.innerHTML = `<div class="empty">No practice scores ${period === 'week' ? 'this week' : 'today'} yet.</div>`;
      return;
    }

    list.innerHTML = rows.map((row, i) => `
      <div class="chem-board-row">
        <div class="chem-board-rank">#${i + 1}</div>
        <div class="chem-board-name">${escapeHtml(row.username || row.user_id || 'Student')}</div>
        <div class="chem-board-score">${Number(row.correct || 0)} C / ${Number(row.attempted || 0)} A</div>
      </div>
    `).join('');
  }

  function chemShowFlash(msg, isWrong) {
    const el = document.getElementById('chem-feedback-flash');
    if (!el) return;
    el.textContent = msg;
    el.className = 'chem-feedback-flash' + (isWrong ? ' wrong' : '');
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 900);
  }

  function chemShowToast(msg) {
    chemShowFlash(msg, false);
  }

  function chemExportData() {
    const blob = new Blob([JSON.stringify(chemMyData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "chemmaster_progress.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function chemImportData(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        chemMyData = JSON.parse(ev.target.result);
        chemEnsureDailyStats();
        chemSave();
        chemSyncAll(false);
        chemShowToast("Progress imported.");
      } catch (_) {
        chemShowToast("Invalid import file.");
      }
    };
    reader.readAsText(file);
  }

  function chemShowStats(type) {
    const isWeak = type === 'weak';
    const sorted = [...chemMyData.myList].sort((a, b) => {
      const sA = chemMyData.stats[a] || { correct: 0, wrong: 0 };
      const sB = chemMyData.stats[b] || { correct: 0, wrong: 0 };
      if (isWeak) return (sB.wrong - sB.correct) - (sA.wrong - sA.correct);
      return sB.correct - sA.correct;
    });
    const top = sorted.slice(0, 5);
    const sheet = document.getElementById('chem-stats-sheet');
    const list = document.getElementById('chem-stats-list');
    document.getElementById('chem-stats-title').textContent = isWeak ? 'Weakest Compounds' : 'Strongest Compounds';
    list.innerHTML = top.length ? top.map((name, i) => {
      const s = chemMyData.stats[name] || { correct: 0, wrong: 0, streak: 0 };
      return `<div class="chem-stat-row"><span class="chem-stat-name">${i + 1}. ${escapeHtml(name)}</span><span class="chem-stat-val">C ${s.correct || 0} / W ${s.wrong || 0} / S ${s.streak || 0}</span></div>`;
    }).join('') : '<div class="chem-stat-row"><span class="chem-stat-name">No data yet</span></div>';
    sheet.classList.add('open');
  }

  function chemCloseStats(event) {
    if (event.target.id === 'chem-stats-sheet') {
      document.getElementById('chem-stats-sheet').classList.remove('open');
    }
  }

  window.chemInitApp = chemInitApp;
  window.chemLearnNew = chemLearnNew;
  window.chemInitLearn = chemInitLearn;
  window.chemChangeLearn = chemChangeLearn;
  window.chemInitPractice = chemInitPractice;
  window.chemGoHome = chemGoHome;
  window.chemUploadStats = chemSyncAll;
  window.chemLoadLeaderboard = chemLoadLeaderboard;
  window.chemUploadProgress = chemSyncAll;
  window.chemDownloadProgress = chemDownloadProgress;
  window.chemSyncAll = chemSyncAll;
  window.chemExportData = chemExportData;
  window.chemImportData = chemImportData;
  window.chemShowStats = chemShowStats;
  window.chemCloseStats = chemCloseStats;

  setInterval(() => {
    chemSyncAll(false);
  }, 2 * 60 * 1000);

  window.addEventListener('beforeunload', () => {
    chemSyncAll(false);
  });

  window.addEventListener('pagehide', () => {
    chemSyncAll(false);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') chemSyncAll(false);
  });

  // Auto Login Boot Check
  async function checkTokenAndLoad() {
    const u = getCookie('fy_u');
    const p = getCookie('fy_p');
    
    // If no token exists but we have cookies, try to silently re-login
    if (!API_CONFIG.token && u && p) {
      try {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('login-submit').textContent = 'Re-authenticating...';
        document.getElementById('login-submit').disabled = true;
        await attemptLogin(u, p);
        document.getElementById('login-screen').style.display = 'none';
      } catch(e) {
        eraseCookie('fy_u');
        eraseCookie('fy_p');
        document.getElementById('login-submit').textContent = 'Login';
        document.getElementById('login-submit').disabled = false;
        return; // Stop and force manual login
      }
    }
  
    if (API_CONFIG.token) {
      document.getElementById('login-screen').style.display = 'none';
      try {
        await loadPortalData();
      } catch(e) {
        // If API failed during loading (likely expired token), trigger cookie login logic
        if (u && p) {
          API_CONFIG.token = '';
          sessionStorage.removeItem('fy_token');
          checkTokenAndLoad(); // Try one more time to auto-login
        } else {
          document.getElementById('login-screen').style.display = 'flex';
        }
      }
    } else {
      document.getElementById('login-screen').style.display = 'flex';
    }
  }
  
  // Start app on load
  checkTokenAndLoad();
  
