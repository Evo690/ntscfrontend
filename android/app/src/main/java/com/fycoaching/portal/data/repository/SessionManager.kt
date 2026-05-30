package com.fycoaching.portal.data.repository

import android.content.Context
import android.content.SharedPreferences

class SessionManager(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("fy_portal_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_TOKEN = "fy_token"
        private const val KEY_CLASS_ID = "fy_class_id"
        private const val KEY_ACADEMIC_YEAR = "fy_academic_year"
        private const val KEY_USER_NAME = "fy_user_name"
        private const val KEY_USER_IMG = "fy_user_img"

        // Cache keys
        private const val KEY_CACHE_TIMETABLE = "cache_timetable"
        private const val KEY_CACHE_EXAMS = "cache_exams"
        private const val KEY_CACHE_NOTICES = "cache_notices"
        private const val KEY_CACHE_ATTENDANCE = "cache_attendance"
    }

    var token: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_TOKEN, value).apply()

    var classId: Int
        get() = prefs.getInt(KEY_CLASS_ID, 0)
        set(value) = prefs.edit().putInt(KEY_CLASS_ID, value).apply()

    var academicYear: Int
        get() = prefs.getInt(KEY_ACADEMIC_YEAR, java.util.Calendar.getInstance().get(java.util.Calendar.YEAR))
        set(value) = prefs.edit().putInt(KEY_ACADEMIC_YEAR, value).apply()

    var userName: String?
        get() = prefs.getString(KEY_USER_NAME, "Student")
        set(value) = prefs.edit().putString(KEY_USER_NAME, value).apply()

    var userImage: String?
        get() = prefs.getString(KEY_USER_IMG, null)
        set(value) = prefs.edit().putString(KEY_USER_IMG, value).apply()

    // Caching properties
    var cachedTimetable: String?
        get() = prefs.getString(KEY_CACHE_TIMETABLE, null)
        set(value) = prefs.edit().putString(KEY_CACHE_TIMETABLE, value).apply()

    var cachedExams: String?
        get() = prefs.getString(KEY_CACHE_EXAMS, null)
        set(value) = prefs.edit().putString(KEY_CACHE_EXAMS, value).apply()

    var cachedNotices: String?
        get() = prefs.getString(KEY_CACHE_NOTICES, null)
        set(value) = prefs.edit().putString(KEY_CACHE_NOTICES, value).apply()

    var cachedAttendance: String?
        get() = prefs.getString(KEY_CACHE_ATTENDANCE, null)
        set(value) = prefs.edit().putString(KEY_CACHE_ATTENDANCE, value).apply()

    fun clear() {
        prefs.edit().clear().apply()
    }

    fun isLoggedIn(): Boolean {
        return !token.isNullOrEmpty()
    }
}
