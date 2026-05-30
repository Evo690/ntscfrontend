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
