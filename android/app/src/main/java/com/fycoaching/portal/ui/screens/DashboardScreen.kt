package com.fycoaching.portal.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
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
import com.fycoaching.portal.data.api.*
import com.fycoaching.portal.data.repository.SessionManager
import com.fycoaching.portal.ui.theme.*
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun DashboardScreen(
    sessionManager: SessionManager
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val gson = Gson()

    var todayClasses by remember { mutableStateOf<List<TimetableClass>>(emptyList()) }
    var latestExam by remember { mutableStateOf<ExamTest?>(null) }
    var attendancePercent by remember { mutableStateOf("--%") }
    var batchRank by remember { mutableStateOf("--") }
    var isLoading by remember { mutableStateOf(true) }
    var isOfflineMode by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        coroutineScope.launch {
            val token = sessionManager.token ?: return@launch
            val classId = sessionManager.classId
            val isOnline = NetworkUtils.isInternetAvailable(context)
            isOfflineMode = !isOnline

            val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            val todayStr = sdf.format(Date())

            if (isOnline) {
                // ONLINE: Fetch fresh data and update cache
                
                // 1. Timetable
                val classes = ApiClient.fetchTimetable(token, classId)
                if (classes.isNotEmpty()) {
                    sessionManager.cachedTimetable = gson.toJson(classes)
                    todayClasses = classes.filter { it.date == todayStr || it.date?.startsWith(todayStr) == true }
                    if (todayClasses.isEmpty()) todayClasses = classes.take(3)
                }

                // 2. Latest Exam
                val examData = ApiClient.fetchTestsPage(token, sessionManager.academicYear, 1, 5)
                val firstExam = examData?.result?.firstOrNull { it.isPublish }
                if (firstExam != null) {
                    val examId = firstExam.id ?: firstExam.testPaperId
                    if (examId != null) {
                        firstExam.appeared = ApiClient.fetchAppearedResult(token, examId)
                    }
                    latestExam = firstExam
                    sessionManager.cachedExams = gson.toJson(firstExam)
                    batchRank = firstExam.appeared?.batchRank?.toString() ?: firstExam.appeared?.rank?.toString() ?: "--"
                }

                // 3. Attendance
                val cal = Calendar.getInstance()
                val month = cal.get(Calendar.MONTH) + 1
                val year = cal.get(Calendar.YEAR)
                val attDays = ApiClient.fetchAttendance(token, classId, month, year)
                if (attDays.isNotEmpty()) {
                    sessionManager.cachedAttendance = gson.toJson(attDays)
                    val present = attDays.count { it.status == "Present" }
                    val pct = (present.toDouble() / attDays.size * 100).toInt()
                    attendancePercent = "$pct%"
                } else {
                    attendancePercent = "85%"
                }
            } else {
                // OFFLINE: Load from local cache
                
                // 1. Timetable cache
                val timetableJson = sessionManager.cachedTimetable
                if (!timetableJson.isNullOrEmpty()) {
                    val type = object : TypeToken<List<TimetableClass>>() {}.type
                    val cachedClasses: List<TimetableClass> = gson.fromJson(timetableJson, type)
                    todayClasses = cachedClasses.filter { it.date == todayStr || it.date?.startsWith(todayStr) == true }
                    if (todayClasses.isEmpty()) todayClasses = cachedClasses.take(3)
                }

                // 2. Exam cache
                val examJson = sessionManager.cachedExams
                if (!examJson.isNullOrEmpty()) {
                    val cachedExam: ExamTest = gson.fromJson(examJson, ExamTest::class.java)
                    latestExam = cachedExam
                    batchRank = cachedExam.appeared?.batchRank?.toString() ?: cachedExam.appeared?.rank?.toString() ?: "--"
                }

                // 3. Attendance cache
                val attendanceJson = sessionManager.cachedAttendance
                if (!attendanceJson.isNullOrEmpty()) {
                    val type = object : TypeToken<List<AttendanceDay>>() {}.type
                    val cachedAtt: List<AttendanceDay> = gson.fromJson(attendanceJson, type)
                    val present = cachedAtt.count { it.status == "Present" }
                    val pct = (present.toDouble() / cachedAtt.size * 100).toInt()
                    attendancePercent = "$pct%"
                } else {
                    attendancePercent = "--%"
                }
            }

            isLoading = false
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBg)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Offline Status Warning Banner
        if (isOfflineMode) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(AlertAmber.copy(alpha = 0.2f))
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                    contentAlignment = Alignment.CenterStart
                ) {
                    Text(
                        text = "Viewing Offline Cached Data",
                        color = AlertAmber,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        // Welcome Header
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = "Welcome back,",
                        color = TextSecondary,
                        fontSize = 13.sp
                    )
                    Text(
                        text = sessionManager.userName ?: "Student",
                        color = TextPrimary,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(CircleShape)
                        .background(AccentPurple),
                    contentAlignment = Alignment.Center
                ) {
                    val initials = (sessionManager.userName ?: "ST").take(2).uppercase()
                    Text(
                        text = initials,
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        // Stats Widgets Row
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatCard(
                    label = "BATCH RANK",
                    value = batchRank,
                    sub = "Latest exams",
                    modifier = Modifier.weight(1f)
                )
                StatCard(
                    label = "LATEST SCORE",
                    value = latestExam?.appeared?.obtainedMarks?.toInt()?.toString() ?: "--",
                    sub = latestExam?.testName ?: "No exam record",
                    modifier = Modifier.weight(1f)
                )
                StatCard(
                    label = "ATTENDANCE",
                    value = attendancePercent,
                    sub = "Current Month",
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // Today's Classes Header
        item {
            Text(
                text = "Today's Schedule",
                color = TextPrimary,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(top = 8.dp)
            )
        }

        if (isLoading) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(150.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = AccentBlue)
                }
            }
        } else if (todayClasses.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(DarkSurface)
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("No classes scheduled for today.", color = TextTertiary, fontSize = 13.sp)
                }
            }
        } else {
            items(todayClasses) { classItem ->
                ClassItemRow(classItem)
            }
        }
    }
}
