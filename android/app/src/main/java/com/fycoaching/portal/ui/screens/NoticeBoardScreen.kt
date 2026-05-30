package com.fycoaching.portal.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fycoaching.portal.data.api.ApiClient
import com.fycoaching.portal.data.api.NetworkUtils
import com.fycoaching.portal.data.api.Notice
import com.fycoaching.portal.data.repository.SessionManager
import com.fycoaching.portal.ui.theme.*
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.launch

@Composable
fun NoticeBoardScreen(
    sessionManager: SessionManager
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val gson = Gson()

    var notices by remember { mutableStateOf<List<Notice>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var isOfflineMode by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        coroutineScope.launch {
            isLoading = true
            val token = sessionManager.token ?: return@launch
            val isOnline = NetworkUtils.isInternetAvailable(context)
            isOfflineMode = !isOnline

            if (isOnline) {
                val fetched = ApiClient.fetchNotices(token, sessionManager.academicYear)
                notices = fetched
                sessionManager.cachedNotices = gson.toJson(fetched)
            } else {
                val noticesJson = sessionManager.cachedNotices
                if (!noticesJson.isNullOrEmpty()) {
                    val type = object : TypeToken<List<Notice>>() {}.type
                    notices = gson.fromJson(noticesJson, type)
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
                text = "Notice Board",
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
        } else if (notices.isEmpty()) {
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
                    text = "No notices found.",
                    color = TextTertiary,
                    fontSize = 13.sp
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(notices) { notice ->
                    NoticeItemRow(notice)
                }
            }
        }
    }
}
