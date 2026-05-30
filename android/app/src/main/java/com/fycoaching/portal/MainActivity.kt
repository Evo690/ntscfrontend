package com.fycoaching.portal

import android.content.Context
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.os.Bundle
import android.view.View
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.fycoaching.portal.data.api.ApiClient
import com.fycoaching.portal.data.repository.SessionManager
import com.fycoaching.portal.data.worker.MessagePollingWorker
import com.fycoaching.portal.ui.screens.DashboardScreen
import com.fycoaching.portal.ui.screens.ExamHallScreen
import com.fycoaching.portal.ui.screens.LoginScreen
import com.fycoaching.portal.ui.screens.NoticeBoardScreen
import com.fycoaching.portal.ui.screens.PracticeScreen
import com.fycoaching.portal.ui.screens.TimetableScreen
import com.fycoaching.portal.ui.theme.DarkBg
import com.fycoaching.portal.ui.theme.DarkSurface
import com.fycoaching.portal.ui.theme.PortalTheme
import com.fycoaching.portal.ui.theme.TextPrimary
import com.fycoaching.portal.ui.theme.TextSecondary
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity() {

    private lateinit var sessionManager: SessionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        sessionManager = SessionManager(this)

        // Set status and navigation bar colors natively
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        window.statusBarColor = Color.parseColor("#070B14")
        window.navigationBarColor = Color.parseColor("#070B14")

        // Request POST_NOTIFICATIONS runtime permission on Android 13+ (API 33+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 101)
        }

        // Register Network Callback to sync offline practice data automatically as soon as internet is available
        val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val networkRequest = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
            
        connectivityManager.registerNetworkCallback(networkRequest, object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                super.onAvailable(network)
                val prefs = getSharedPreferences("fy_portal_prefs", Context.MODE_PRIVATE)
                val synced = prefs.getBoolean("practice_synced", true)
                if (!synced) {
                    val username = prefs.getString("fy_user_name", "Student") ?: "Student"
                    val correct = prefs.getInt("practice_correct", 0)
                    val wrong = prefs.getInt("practice_wrong", 0)
                    val attempted = prefs.getInt("practice_attempted", 0)
                    
                    lifecycleScope.launch {
                        val success = ApiClient.syncPracticeProgress(
                            username = username,
                            correct = correct,
                            wrong = wrong,
                            attempted = attempted
                        )
                        if (success) {
                            prefs.edit().putBoolean("practice_synced", true).apply()
                        }
                    }
                }
            }
        })

        // Enqueue WorkManager background polling request for new messages (polls every 15 minutes)
        val workRequest = PeriodicWorkRequestBuilder<MessagePollingWorker>(
            15, TimeUnit.MINUTES
        ).build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "fy_message_polling",
            ExistingPeriodicWorkPolicy.KEEP,
            workRequest
        )

        setContent {
            PortalTheme {
                var isLoggedIn by remember { mutableStateOf(sessionManager.isLoggedIn()) }

                if (!isLoggedIn) {
                    LoginScreen(
                        sessionManager = sessionManager,
                        onLoginSuccess = { isLoggedIn = true }
                    )
                } else {
                    MainNavigationContainer(
                        sessionManager = sessionManager,
                        onLogout = {
                            sessionManager.clear()
                            isLoggedIn = false
                        }
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainNavigationContainer(
    sessionManager: SessionManager,
    onLogout: () -> Unit
) {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    Scaffold(
        bottomBar = {
            NavigationBar(
                containerColor = DarkSurface,
                contentColor = TextPrimary
            ) {
                // Dashboard Item
                NavigationBarItem(
                    selected = currentRoute == "dashboard",
                    onClick = {
                        if (currentRoute != "dashboard") {
                            navController.navigate("dashboard") {
                                popUpTo("dashboard") { inclusive = true }
                            }
                        }
                    },
                    icon = { Icon(Icons.Default.Home, contentDescription = "Dashboard") },
                    label = { Text("Dashboard") }
                )
                // Timetable Item
                NavigationBarItem(
                    selected = currentRoute == "timetable",
                    onClick = {
                        if (currentRoute != "timetable") {
                            navController.navigate("timetable") {
                                popUpTo("dashboard")
                            }
                        }
                    },
                    icon = { Icon(Icons.Default.DateRange, contentDescription = "Timetable") },
                    label = { Text("Timetable") }
                )
                // Practice Item (Offline Chemistry Practice Quiz)
                NavigationBarItem(
                    selected = currentRoute == "practice",
                    onClick = {
                        if (currentRoute != "practice") {
                            navController.navigate("practice") {
                                popUpTo("dashboard")
                            }
                        }
                    },
                    icon = { Icon(Icons.Default.Star, contentDescription = "Practice") },
                    label = { Text("Practice") }
                )
                // Exams Item
                NavigationBarItem(
                    selected = currentRoute == "exams",
                    onClick = {
                        if (currentRoute != "exams") {
                            navController.navigate("exams") {
                                popUpTo("dashboard")
                            }
                        }
                    },
                    icon = { Icon(Icons.Default.Info, contentDescription = "Exams") },
                    label = { Text("Exams") }
                )
                // Notices Item
                NavigationBarItem(
                    selected = currentRoute == "notices",
                    onClick = {
                        if (currentRoute != "notices") {
                            navController.navigate("notices") {
                                popUpTo("dashboard")
                            }
                        }
                    },
                    icon = { Icon(Icons.Default.Notifications, contentDescription = "Notices") },
                    label = { Text("Notices") }
                )
            }
        },
        topBar = {
            TopAppBar(
                title = { Text("FY Coaching Portal", fontWeight = FontWeight.Bold, color = TextPrimary) },
                actions = {
                    TextButton(onClick = onLogout) {
                        Text("Logout", color = TextSecondary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = DarkSurface,
                    titleContentColor = TextPrimary
                )
            )
        }
    ) { paddingValues ->
        NavHost(
            navController = navController,
            startDestination = "dashboard",
            modifier = Modifier
                .fillMaxSize()
                .background(DarkBg)
                .padding(paddingValues)
        ) {
            composable("dashboard") {
                DashboardScreen(sessionManager = sessionManager)
            }
            composable("timetable") {
                TimetableScreen(sessionManager = sessionManager)
            }
            composable("practice") {
                PracticeScreen(sessionManager = sessionManager)
            }
            composable("exams") {
                ExamHallScreen(sessionManager = sessionManager)
            }
            composable("notices") {
                NoticeBoardScreen(sessionManager = sessionManager)
            }
        }
    }
}
