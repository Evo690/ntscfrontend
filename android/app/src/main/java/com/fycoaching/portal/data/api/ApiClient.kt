package com.fycoaching.portal.data.api

import com.google.gson.Gson
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.*

object ApiClient {
    private val client = OkHttpClient()
    private val gson = Gson()
    private val mediaTypeJson = "application/json; charset=utf-8".toMediaType()

    private fun authHeaders(token: String): Map<String, String> {
        return mapOf(
            "Authorization" to "Bearer $token",
            "Content-Type" to "application/json",
            "Accept" to "application/json",
            "Origin" to "https://ntsc.narayanatalent.com",
            "Referer" to "https://ntsc.narayanatalent.com/"
        )
    }

    suspend fun login(userName: String, encryptedPass: String): LoginResponseWrapper? = withContext(Dispatchers.IO) {
        val loginUrl = "https://ntsc.narayanatalent.com/login-service/api/login"
        val jsonPayload = gson.toJson(mapOf(
            "userName" to userName,
            "password" to encryptedPass,
            "deviceType" to "Web",
            "browser" to "firefox",
            "appVersion" to "",
            "deviceToken" to ""
        ))
        
        val request = Request.Builder()
            .url(loginUrl)
            .post(jsonPayload.toRequestBody(mediaTypeJson))
            .addHeader("Content-Type", "application/json")
            .addHeader("Accept", "application/json")
            .build()

        try {
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val bodyStr = response.body?.string() ?: return@withContext null
                gson.fromJson(bodyStr, LoginResponseWrapper::class.java)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun fetchTimetable(token: String, classId: Int): List<TimetableClass> = withContext(Dispatchers.IO) {
        val requestUrl = "https://ntsc.narayanatalent.com/classes-service/api/LiveClass/GetStudentClasses/$classId"
        val requestBuilder = Request.Builder().url(requestUrl)
        authHeaders(token).forEach { (k, v) -> requestBuilder.addHeader(k, v) }

        try {
            client.newCall(requestBuilder.build()).execute().use { response ->
                if (!response.isSuccessful) return@withContext emptyList()
                val bodyStr = response.body?.string() ?: return@withContext emptyList()
                val wrapper = gson.fromJson(bodyStr, TimetableWrapper::class.java)
                wrapper.data ?: emptyList()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun fetchTestsPage(token: String, academicYear: Int, pageNumber: Int, pageSize: Int): ExamResponseData? = withContext(Dispatchers.IO) {
        val requestUrl = "https://ntsc.narayanatalent.com/exam-service/api/ExaminationHall/GetTests"
        val jsonPayload = gson.toJson(mapOf(
            "searchKey" to "",
            "pageNumber" to pageNumber,
            "pageSize" to pageSize,
            "id" to 0,
            "academicYear" to academicYear.toString()
        ))

        val requestBuilder = Request.Builder()
            .url(requestUrl)
            .post(jsonPayload.toRequestBody(mediaTypeJson))
        
        authHeaders(token).forEach { (k, v) -> requestBuilder.addHeader(k, v) }

        try {
            client.newCall(requestBuilder.build()).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val bodyStr = response.body?.string() ?: return@withContext null
                val wrapper = gson.fromJson(bodyStr, ExamResponseWrapper::class.java)
                wrapper.data
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun fetchAppearedResult(token: String, testId: Int): AppearedResult? = withContext(Dispatchers.IO) {
        val requestUrl = "https://ntsc.narayanatalent.com/exam-service/api/ExaminationHall/GetAppearedResult"
        val jsonPayload = gson.toJson(mapOf(
            "id" to testId,
            "pageNumber" to 1,
            "pageSize" to 10
        ))

        val requestBuilder = Request.Builder()
            .url(requestUrl)
            .post(jsonPayload.toRequestBody(mediaTypeJson))
        
        authHeaders(token).forEach { (k, v) -> requestBuilder.addHeader(k, v) }

        try {
            client.newCall(requestBuilder.build()).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val bodyStr = response.body?.string() ?: return@withContext null
                val wrapper = gson.fromJson(bodyStr, AppearedResultWrapper::class.java)
                wrapper.data?.result?.firstOrNull()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun fetchResultAnalysis(token: String, examId: Int): ResultAnalysisData? = withContext(Dispatchers.IO) {
        val requestUrl = "https://ntsc.narayanatalent.com/exam-service/api/ExaminationHall/GetResultAnalysis/$examId"
        val requestBuilder = Request.Builder().url(requestUrl)
        authHeaders(token).forEach { (k, v) -> requestBuilder.addHeader(k, v) }

        try {
            client.newCall(requestBuilder.build()).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val bodyStr = response.body?.string() ?: return@withContext null
                val wrapper = gson.fromJson(bodyStr, ResultAnalysisWrapper::class.java)
                wrapper.data
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun fetchNotices(token: String, academicYear: Int): List<Notice> = withContext(Dispatchers.IO) {
        val requestUrl = "https://ntsc.narayanatalent.com/general-service/api/NoticeBoard/GetStudentNotice"
        val jsonPayload = gson.toJson(mapOf(
            "startDate" to "",
            "endDate" to "",
            "searchKey" to "",
            "pageNumber" to 1,
            "pageSize" to 20,
            "academicYear" to academicYear
        ))

        val requestBuilder = Request.Builder()
            .url(requestUrl)
            .post(jsonPayload.toRequestBody(mediaTypeJson))
        
        authHeaders(token).forEach { (k, v) -> requestBuilder.addHeader(k, v) }

        try {
            client.newCall(requestBuilder.build()).execute().use { response ->
                if (!response.isSuccessful) return@withContext emptyList()
                val bodyStr = response.body?.string() ?: return@withContext emptyList()
                val wrapper = gson.fromJson(bodyStr, NoticesWrapper::class.java)
                wrapper.data?.data ?: emptyList()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun fetchStudentBatches(token: String, academicYear: Int): List<StudentBatch> = withContext(Dispatchers.IO) {
        val requestUrl = "https://ntsc.narayanatalent.com/student-service/api/EnrolledCourse/GetStudentBatch?academicYear=$academicYear"
        val requestBuilder = Request.Builder().url(requestUrl)
        authHeaders(token).forEach { (k, v) -> requestBuilder.addHeader(k, v) }

        try {
            client.newCall(requestBuilder.build()).execute().use { response ->
                if (!response.isSuccessful) return@withContext emptyList()
                val bodyStr = response.body?.string() ?: return@withContext emptyList()
                val wrapper = gson.fromJson(bodyStr, StudentBatchWrapper::class.java)
                wrapper.data ?: emptyList()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun fetchAttendance(token: String, classId: Int, month: Int, year: Int): List<AttendanceDay> = withContext(Dispatchers.IO) {
        val requestUrl = "https://ntsc.narayanatalent.com/classes-service/api/Attendance/GetStudentAttendance"
        val jsonPayload = gson.toJson(mapOf(
            "batchId" to classId,
            "year" to year,
            "month" to month
        ))

        val requestBuilder = Request.Builder()
            .url(requestUrl)
            .post(jsonPayload.toRequestBody(mediaTypeJson))
        
        authHeaders(token).forEach { (k, v) -> requestBuilder.addHeader(k, v) }

        try {
            client.newCall(requestBuilder.build()).execute().use { response ->
                if (!response.isSuccessful) return@withContext emptyList()
                val bodyStr = response.body?.string() ?: return@withContext emptyList()
                val wrapper = gson.fromJson(bodyStr, AttendanceWrapper::class.java)
                wrapper.data ?: emptyList()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    // Supabase Daily leaderboard stats synchronization API
    suspend fun syncPracticeProgress(
        username: String,
        correct: Int,
        wrong: Int,
        attempted: Int
    ): Boolean = withContext(Dispatchers.IO) {
        val supabaseUrl = "https://rhsrrljgejgyqnndcdia.supabase.co/rest/v1/leaderboard_stats"
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val todayStr = sdf.format(Date())
        
        val payload = gson.toJson(listOf(mapOf(
            "user_id" to username,
            "username" to username,
            "stat_date" to todayStr,
            "correct" to correct,
            "wrong" to wrong,
            "attempted" to attempted,
            "time_spent" to 0
        )))

        val request = Request.Builder()
            .url(supabaseUrl)
            .post(payload.toRequestBody(mediaTypeJson))
            .addHeader("apikey", "sb_publishable_vGRx87SiIMaJXeGnrMVN9g_bLPu899U")
            .addHeader("Authorization", "Bearer sb_publishable_vGRx87SiIMaJXeGnrMVN9g_bLPu899U")
            .addHeader("Content-Type", "application/json")
            .addHeader("Prefer", "resolution=merge-duplicates")
            .build()

        try {
            client.newCall(request).execute().use { response ->
                response.isSuccessful
            }
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun fetchMessageGroups(token: String, academicYear: Int): List<MessageGroup> = withContext(Dispatchers.IO) {
        val targetUrl = "https://ntsc.narayanatalent.com/general-service/api/MessageGroup/GetStudentGroup"
        val jsonPayload = gson.toJson(mapOf(
            "startDate" to "",
            "endDate" to "",
            "searchKey" to "",
            "pageNumber" to 1,
            "pageSize" to 250,
            "academicYear" to academicYear
        ))

        val requestBuilder = Request.Builder()
            .url(targetUrl)
            .post(jsonPayload.toRequestBody(mediaTypeJson))
        
        authHeaders(token).forEach { (k, v) -> requestBuilder.addHeader(k, v) }

        try {
            client.newCall(requestBuilder.build()).execute().use { response ->
                if (!response.isSuccessful) return@withContext emptyList()
                val bodyStr = response.body?.string() ?: return@withContext emptyList()
                val wrapper = gson.fromJson(bodyStr, MessageGroupResponse::class.java)
                wrapper.getGroups()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }
}
