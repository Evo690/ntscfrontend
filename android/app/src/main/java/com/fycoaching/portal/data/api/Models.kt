package com.fycoaching.portal.data.api

import com.google.gson.annotations.SerializedName

data class LoginResponseWrapper(
    @SerializedName("statusCode") val statusCode: Int,
    @SerializedName("message") val message: String?,
    @SerializedName("data") val data: LoginData?
)

data class LoginData(
    @SerializedName("token") val token: String?,
    @SerializedName("academicYear") val academicYear: Int?,
    @SerializedName("studentDetail") val studentDetail: StudentDetail?
)

data class StudentDetail(
    @SerializedName("name") val name: String?,
    @SerializedName("profileImage") val profileImage: String?,
    @SerializedName("curentClassId") val curentClassId: Int?
)

data class StudentBatchWrapper(
    @SerializedName("data") val data: List<StudentBatch>?
)

data class StudentBatch(
    @SerializedName("id") val id: Int,
    @SerializedName("title") val title: String
)

data class TimetableWrapper(
    @SerializedName("data") val data: List<TimetableClass>?
)

data class TimetableClass(
    @SerializedName("subjectName") val subjectName: String?,
    @SerializedName("teacherName") val teacherName: String?,
    @SerializedName("classTime") val classTime: String?,
    @SerializedName("date") val date: String?,
    @SerializedName("startTime") val startTime: String?,
    @SerializedName("endTime") val endTime: String?,
    @SerializedName("joinUrl") val joinUrl: String?
)

data class ExamResponseWrapper(
    @SerializedName("data") val data: ExamResponseData?
)

data class ExamResponseData(
    @SerializedName("result") val result: List<ExamTest>?,
    @SerializedName("totalRecord") val totalRecord: Int?
)

data class ExamTest(
    @SerializedName("id") val id: Int,
    @SerializedName("testPaperId") val testPaperId: Int?,
    @SerializedName("testName") val testName: String?,
    @SerializedName("examDate") val examDate: String?,
    @SerializedName("testDate") val testDate: String?,
    @SerializedName("startDate") val startDate: String?,
    @SerializedName("isPublish") val isPublish: Boolean,
    var appeared: AppearedResult? = null
)

data class AppearedResultWrapper(
    @SerializedName("data") val data: AppearedResultData?
)

data class AppearedResultData(
    @SerializedName("result") val result: List<AppearedResult>?
)

data class AppearedResult(
    @SerializedName("examId") val examId: Int?,
    @SerializedName("totalMarks") val totalMarks: Double?,
    @SerializedName("obtainedMarks") val obtainedMarks: Double?,
    @SerializedName("totalSubjectMarks") val totalSubjectMarks: Double?,
    @SerializedName("rank") val rank: Int?,
    @SerializedName("batchRank") val batchRank: Int?
)

data class ResultAnalysisWrapper(
    @SerializedName("data") val data: ResultAnalysisData?
)

data class ResultAnalysisData(
    @SerializedName("testName") val testName: String?,
    @SerializedName("rank") val rank: Int?,
    @SerializedName("batchRank") val batchRank: Int?,
    @SerializedName("result") val result: ResultMetrics?
)

data class ResultMetrics(
    @SerializedName("totalMarks") val totalMarks: Double?,
    @SerializedName("totalSubjectMarks") val totalSubjectMarks: Double?
)

data class NoticesWrapper(
    @SerializedName("data") val data: NoticesData?
)

data class NoticesData(
    @SerializedName("data") val data: List<Notice>?
)

data class Notice(
    @SerializedName("id") val id: Int,
    @SerializedName("title") val title: String?,
    @SerializedName("createdDate") val createdDate: String?,
    @SerializedName("description") val description: String?
)

data class AttendanceWrapper(
    @SerializedName("data") val data: List<AttendanceDay>?
)

data class AttendanceDay(
    @SerializedName("date") val date: String?,
    @SerializedName("status") val status: String? // e.g., "Present", "Absent"
)

data class MessageGroupResponse(
    @SerializedName("data") val data: MessageGroupDataWrapper?
) {
    fun getGroups(): List<MessageGroup> {
        return data?.data ?: data?.result ?: emptyList()
    }
}

data class MessageGroupDataWrapper(
    @SerializedName("data") val data: List<MessageGroup>?,
    @SerializedName("result") val result: List<MessageGroup>?
)

data class MessageGroup(
    @SerializedName("groupId") val groupId: String?,
    @SerializedName("title") val title: String?,
    @SerializedName("unreadCount") val unreadCount: Int?,
    @SerializedName("lastMessageTime") val lastMessageTime: String?,
    @SerializedName("lastMessageText") val lastMessageText: String?,
    @SerializedName("iconUrl") val iconUrl: String?
)
