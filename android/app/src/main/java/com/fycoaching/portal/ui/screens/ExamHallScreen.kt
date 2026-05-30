package com.fycoaching.portal.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fycoaching.portal.data.api.ApiClient
import com.fycoaching.portal.data.api.ExamTest
import com.fycoaching.portal.data.api.NetworkUtils
import com.fycoaching.portal.data.repository.SessionManager
import com.fycoaching.portal.ui.theme.*
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.launch

@Composable
fun ExamHallScreen(
    sessionManager: SessionManager
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val gson = Gson()

    var exams by remember { mutableStateOf<List<ExamTest>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var expandedItemIndex by remember { mutableStateOf(-1) }
    var isOfflineMode by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        coroutineScope.launch {
            isLoading = true
            val token = sessionManager.token ?: return@launch
            val isOnline = NetworkUtils.isInternetAvailable(context)
            isOfflineMode = !isOnline

            if (isOnline) {
                val response = ApiClient.fetchTestsPage(token, sessionManager.academicYear, 1, 30)
                val rawExams = response?.result ?: emptyList()
                
                // Enrich appeared scores in background
                val enrichedExams = rawExams.map { test ->
                    val examId = test.id ?: test.testPaperId
                    if (examId != null) {
                        test.appeared = ApiClient.fetchAppearedResult(token, examId)
                    }
                    test
                }
                exams = enrichedExams
                sessionManager.cachedExams = gson.toJson(enrichedExams)
            } else {
                // Offline: Load from cached exams
                val examsJson = sessionManager.cachedExams
                if (!examsJson.isNullOrEmpty()) {
                    try {
                        val type = object : TypeToken<List<ExamTest>>() {}.type
                        exams = gson.fromJson(examsJson, type)
                    } catch (e: Exception) {
                        // Fallback in case cache had a single object previously
                        val singleType = object : TypeToken<ExamTest>() {}.type
                        val single: ExamTest = gson.fromJson(examsJson, singleType)
                        exams = listOf(single)
                    }
                }
            }
            isLoading = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBg)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Examination Hall",
                color = TextPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
            if (isOfflineMode) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(AlertAmber.copy(alpha = 0.2f))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text("Offline", color = AlertAmber, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = AccentBlue)
            }
        } else if (exams.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .clip(RoundedCornerShape(12.dp))
                    .background(DarkSurface)
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "No exam records found.",
                    color = TextTertiary,
                    fontSize = 13.sp
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                itemsIndexed(exams) { index, exam ->
                    ExamRow(
                        exam = exam,
                        isExpanded = index == expandedItemIndex,
                        onClick = {
                            expandedItemIndex = if (expandedItemIndex == index) -1 else index
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun ExamRow(
    exam: ExamTest,
    isExpanded: Boolean,
    onClick: () -> Unit
) {
    val appeared = exam.appeared
    val hasResult = appeared != null

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = DarkSurface
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            // Header: Exam Name and Marks Badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = exam.testName ?: "Examination",
                        color = TextPrimary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Date: ${exam.examDate ?: exam.testDate ?: exam.startDate ?: "TBD"}",
                        color = TextTertiary,
                        fontSize = 11.sp
                    )
                }

                Spacer(modifier = Modifier.width(8.dp))

                // Status / Marks Badge
                if (hasResult && appeared != null) {
                    val obtained = appeared.obtainedMarks ?: 0.0
                    val total = appeared.totalMarks ?: appeared.totalSubjectMarks ?: 0.0
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(SuccessGreen.copy(alpha = 0.15f))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = "${obtained.toInt()}/${total.toInt()} M",
                            color = SuccessGreen,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                } else {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(if (exam.isPublish) AccentBlue.copy(alpha = 0.15f) else TextTertiary.copy(alpha = 0.15f))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = if (exam.isPublish) "Published" else "Scheduled",
                            color = if (exam.isPublish) AccentBlue else TextTertiary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Expanded Details
            AnimatedVisibility(visible = isExpanded) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp)
                ) {
                    HorizontalDivider(color = DarkBorder, thickness = 1.dp)
                    Spacer(modifier = Modifier.height(12.dp))

                    if (hasResult && appeared != null) {
                        // Display stats: Marks, Ranks
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            // Marks Details
                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(DarkBg)
                                    .padding(8.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text("Marks", color = TextTertiary, fontSize = 10.sp, fontWeight = FontWeight.Medium)
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = "${appeared.obtainedMarks ?: 0.0} / ${appeared.totalMarks ?: appeared.totalSubjectMarks ?: 100.0}",
                                    color = AccentBlue,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            // Overall Rank
                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(DarkBg)
                                    .padding(8.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text("Rank", color = TextTertiary, fontSize = 10.sp, fontWeight = FontWeight.Medium)
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = appeared.rank?.toString() ?: "N/A",
                                    color = AlertAmber,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            // Batch Rank
                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(DarkBg)
                                    .padding(8.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text("Batch Rank", color = TextTertiary, fontSize = 10.sp, fontWeight = FontWeight.Medium)
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = appeared.batchRank?.toString() ?: "N/A",
                                    color = AlertAmber,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    } else {
                        // Display simple details for scheduled / pending exam
                        Text(
                            text = "Exam ID: ${exam.id}\nTest Paper ID: ${exam.testPaperId ?: "N/A"}\nNo result has been published for this test yet.",
                            color = TextSecondary,
                            fontSize = 12.sp,
                            lineHeight = 16.sp
                        )
                    }
                }
            }
        }
    }
}

