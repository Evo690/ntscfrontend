package com.fycoaching.portal.data.worker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.fycoaching.portal.MainActivity
import com.fycoaching.portal.data.api.ApiClient
import com.fycoaching.portal.data.repository.SessionManager

class MessagePollingWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val sessionManager = SessionManager(applicationContext)
        val token = sessionManager.token ?: return Result.success()
        val academicYear = sessionManager.academicYear

        try {
            val groups = ApiClient.fetchMessageGroups(token, academicYear)
            val prefs = applicationContext.getSharedPreferences("fy_portal_prefs", Context.MODE_PRIVATE)

            groups.forEach { group ->
                val groupId = group.groupId ?: return@forEach
                val unreadCount = group.unreadCount ?: 0
                
                if (unreadCount > 0) {
                    val lastMsgText = group.lastMessageText ?: "You have new unread messages"
                    val groupTitle = group.title ?: "New Message"
                    
                    // Retrieve cached stats to avoid duplicated alerts
                    val cacheKeyCount = "msg_cache_count_$groupId"
                    val cacheKeyText = "msg_cache_text_$groupId"
                    val savedCount = prefs.getInt(cacheKeyCount, 0)
                    val savedText = prefs.getString(cacheKeyText, "")
                    
                    if (unreadCount > savedCount || lastMsgText != savedText) {
                        // Trigger a native notification
                        showNotification(
                            context = applicationContext,
                            groupTitle = groupTitle,
                            messageText = lastMsgText,
                            groupId = groupId
                        )
                        
                        // Cache current unread states
                        prefs.edit()
                            .putInt(cacheKeyCount, unreadCount)
                            .putString(cacheKeyText, lastMsgText)
                            .apply()
                    }
                } else {
                    // Reset unread state caches if count is 0
                    prefs.edit()
                        .remove("msg_cache_count_$groupId")
                        .remove("msg_cache_text_$groupId")
                        .apply()
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            return Result.retry()
        }

        return Result.success()
    }

    private fun showNotification(context: Context, groupTitle: String, messageText: String, groupId: String) {
        val channelId = "fy_messages_channel"
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "New Student Messages",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Notifies when student portal receives a message"
            }
            notificationManager.createNotificationChannel(channel)
        }

        // Action Intent to launch MainActivity when clicking the notification
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            groupId.hashCode(),
            intent,
            PendingIntent.FLAG_IMMUTABLE
        )

        // Using app's launcher foreground vector monogram icon!
        val iconRes = context.resources.getIdentifier(
            "ic_launcher_foreground",
            "drawable",
            context.packageName
        ).let { if (it != 0) it else android.R.drawable.ic_dialog_info }

        val builder = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(iconRes)
            .setContentTitle(groupTitle)
            .setContentText(messageText)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)

        notificationManager.notify(groupId.hashCode(), builder.build())
    }
}
