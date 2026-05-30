package com.fycoaching.portal.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fycoaching.portal.data.api.ApiClient
import com.fycoaching.portal.data.crypto.RsaEncryptor
import com.fycoaching.portal.data.repository.SessionManager
import com.fycoaching.portal.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(
    sessionManager: SessionManager,
    onLoginSuccess: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf("") }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(DarkBg, Color(0xFF0A0F1D))
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(DarkSurface)
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // "FY" Monogram logo box
            Box(
                modifier = Modifier
                    .size(54.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(AccentBlue),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "FY",
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace
                )
            }

            Text(
                text = "FY Coaching Login",
                color = TextPrimary,
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold
            )

            if (errorMessage.isNotEmpty()) {
                Text(
                    text = errorMessage,
                    color = ErrorRed,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium
                )
            }

            OutlinedTextField(
                value = username,
                onValueChange = { username = it },
                placeholder = { Text("Username or Mobile Number", color = TextTertiary) },
                singleLine = true,
                colors = TextFieldDefaults.colors(
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary,
                    focusedContainerColor = DarkSurfaceVariant,
                    unfocusedContainerColor = DarkSurfaceVariant,
                    focusedIndicatorColor = AccentBlue,
                    unfocusedIndicatorColor = DarkBorder
                ),
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(8.dp)
            )

            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                placeholder = { Text("Password", color = TextTertiary) },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                colors = TextFieldDefaults.colors(
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary,
                    focusedContainerColor = DarkSurfaceVariant,
                    unfocusedContainerColor = DarkSurfaceVariant,
                    focusedIndicatorColor = AccentBlue,
                    unfocusedIndicatorColor = DarkBorder
                ),
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(8.dp)
            )

            Button(
                onClick = {
                    if (username.isBlank() || password.isBlank()) {
                        errorMessage = "Please enter credentials."
                        return@Button
                    }
                    isLoading = true
                    errorMessage = ""
                    coroutineScope.launch {
                        val encrypted = RsaEncryptor.encrypt(password)
                        if (encrypted.isEmpty()) {
                            errorMessage = "Encryption failed. Please retry."
                            isLoading = false
                            return@launch
                        }

                        val response = ApiClient.login(username, encrypted)
                        if (response?.data?.token != null) {
                            val data = response.data
                            sessionManager.token = data.token
                            sessionManager.academicYear = data.academicYear ?: 2026
                            sessionManager.classId = data.studentDetail?.curentClassId ?: 0
                            sessionManager.userName = data.studentDetail?.name ?: "Student"
                            sessionManager.userImage = data.studentDetail?.profileImage
                            onLoginSuccess()
                        } else {
                            errorMessage = response?.message ?: "Login failed. Check credentials."
                        }
                        isLoading = false
                    }
                },
                enabled = !isLoading,
                colors = ButtonDefaults.buttonColors(
                    containerColor = AccentBlue,
                    contentColor = Color.White,
                    disabledContainerColor = AccentBlue.copy(alpha = 0.5f)
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp)
                    .height(48.dp),
                shape = RoundedCornerShape(8.dp)
            ) {
                if (isLoading) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                } else {
                    Text("Login", fontSize = 14.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
