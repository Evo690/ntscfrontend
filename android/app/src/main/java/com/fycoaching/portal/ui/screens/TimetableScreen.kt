package com.fycoaching.portal.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import com.fycoaching.portal.data.api.NetworkUtils
import com.fycoaching.portal.data.api.StudentBatch
import com.fycoaching.portal.data.api.TimetableClass
import com.fycoaching.portal.data.repository.SessionManager
import com.fycoaching.portal.ui.theme.*
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TimetableScreen(
    sessionManager: SessionManager
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val gson = Gson()

    var academicYear by remember { mutableStateOf(sessionManager.academicYear) }
    var batches by remember { mutableStateOf<List<StudentBatch>>(emptyList()) }
    var selectedBatch by remember { mutableStateOf<StudentBatch?>(null) }
    var timetableList by remember { mutableStateOf<List<TimetableClass>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var isOfflineMode by remember { mutableStateOf(false) }

    var isYearDropdownExpanded by remember { mutableStateOf(false) }
    var isBatchDropdownExpanded by remember { mutableStateOf(false) }

    // Load batches and initial timetable
    LaunchedEffect(academicYear) {
        coroutineScope.launch {
            isLoading = true
            val token = sessionManager.token ?: return@launch
            val isOnline = NetworkUtils.isInternetAvailable(context)
            isOfflineMode = !isOnline

            if (isOnline) {
                val fetchedBatches = ApiClient.fetchStudentBatches(token, academicYear)
                batches = fetchedBatches
                selectedBatch = fetchedBatches.firstOrNull()
                if (selectedBatch != null) {
                    sessionManager.classId = selectedBatch!!.id
                    val classes = ApiClient.fetchTimetable(token, selectedBatch!!.id)
                    timetableList = classes
                    sessionManager.cachedTimetable = gson.toJson(classes)
                } else {
                    timetableList = emptyList()
                }
            } else {
                // Offline: Load from cached timetable directly
                val timetableJson = sessionManager.cachedTimetable
                if (!timetableJson.isNullOrEmpty()) {
                    val type = object : TypeToken<List<TimetableClass>>() {}.type
                    timetableList = gson.fromJson(timetableJson, type)
                }
                batches = listOf(StudentBatch(sessionManager.classId, "Cached Batch"))
                selectedBatch = batches.firstOrNull()
            }
            isLoading = false
        }
    }

    // Load timetable when batch is changed (Online mode only)
    LaunchedEffect(selectedBatch) {
        if (selectedBatch == null || isOfflineMode) return@LaunchedEffect
        coroutineScope.launch {
            isLoading = true
            val token = sessionManager.token ?: return@launch
            sessionManager.classId = selectedBatch!!.id
            val classes = ApiClient.fetchTimetable(token, selectedBatch!!.id)
            timetableList = classes
            sessionManager.cachedTimetable = gson.toJson(classes)
            isLoading = false
        }
    }

    val currentYear = Calendar.getInstance().get(Calendar.YEAR)
    val yearsList = listOf(currentYear - 1, currentYear, currentYear + 1)

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
                text = "Weekly Timetable",
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

        // Dropdown Selector Rows (disabled or limited in offline mode)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            // Year Selector
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(8.dp))
                    .background(DarkSurface)
                    .clickable(enabled = !isOfflineMode) { isYearDropdownExpanded = true }
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                contentAlignment = Alignment.CenterStart
            ) {
                Text(
                    text = "$academicYear - ${academicYear + 1}",
                    color = if (isOfflineMode) TextTertiary else TextPrimary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium
                )
                if (!isOfflineMode) {
                    DropdownMenu(
                        expanded = isYearDropdownExpanded,
                        onDismissRequest = { isYearDropdownExpanded = false },
                        modifier = Modifier.background(DarkSurfaceVariant)
                    ) {
                        yearsList.forEach { y ->
                            DropdownMenuItem(
                                text = { Text("$y - ${y + 1}", color = TextPrimary) },
                                onClick = {
                                    academicYear = y
                                    sessionManager.academicYear = y
                                    isYearDropdownExpanded = false
                                }
                            )
                        }
                    }
                }
            }

            // Batch Selector
            Box(
                modifier = Modifier
                    .weight(1.5f)
                    .clip(RoundedCornerShape(8.dp))
                    .background(DarkSurface)
                    .clickable(enabled = !isOfflineMode) { isBatchDropdownExpanded = true }
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                contentAlignment = Alignment.CenterStart
            ) {
                Text(
                    text = selectedBatch?.title ?: "Select Batch",
                    color = if (isOfflineMode) TextTertiary else TextPrimary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1
                )
                if (!isOfflineMode) {
                    DropdownMenu(
                        expanded = isBatchDropdownExpanded,
                        onDismissRequest = { isBatchDropdownExpanded = false },
                        modifier = Modifier.background(DarkSurfaceVariant)
                    ) {
                        if (batches.isEmpty()) {
                            DropdownMenuItem(
                                text = { Text("No Batches Found", color = TextTertiary) },
                                onClick = { isBatchDropdownExpanded = false }
                            )
                        } else {
                            batches.forEach { b ->
                                DropdownMenuItem(
                                    text = { Text(b.title, color = TextPrimary) },
                                    onClick = {
                                        selectedBatch = b
                                        isBatchDropdownExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }

        // Classes list
        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = AccentBlue)
            }
        } else if (timetableList.isEmpty()) {
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
                    text = "No classes found for this batch.",
                    color = TextTertiary,
                    fontSize = 13.sp
                )
            }
        } else {
            // Group classes by Date and display chronologically
            val groupedClasses = timetableList
                .sortedBy { it.date ?: "" }
                .groupBy { it.date ?: "No Date" }

            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                groupedClasses.forEach { (date, classes) ->
                    item {
                        // Date header
                        val displayDate = try {
                            val parser = SimpleDateFormat("yyyy-MM-dd", Locale.US)
                            val formatter = SimpleDateFormat("EEEE, d MMMM yyyy", Locale.US)
                            parser.parse(date)?.let { formatter.format(it) } ?: date
                        } catch (e: Exception) {
                            date
                        }
                        Text(
                            text = displayDate,
                            color = AccentBlue,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(vertical = 4.dp)
                        )
                    }
                    items(classes) { classItem ->
                        ClassItemRow(classItem)
                    }
                }
            }
        }
    }
}
