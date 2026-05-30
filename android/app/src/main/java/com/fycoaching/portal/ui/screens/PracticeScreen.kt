package com.fycoaching.portal.ui.screens

import android.content.Context
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fycoaching.portal.data.api.ApiClient
import com.fycoaching.portal.data.api.NetworkUtils
import com.fycoaching.portal.data.repository.SessionManager
import com.fycoaching.portal.ui.theme.*
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.io.InputStream
import kotlinx.coroutines.launch

@Composable
fun PracticeScreen(
    sessionManager: SessionManager
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val gson = Gson()

    val prefs = remember { context.getSharedPreferences("fy_portal_prefs", Context.MODE_PRIVATE) }

    var compoundsList by remember { mutableStateOf<List<Compound>>(emptyList()) }
    var currentQuestionIndex by remember { mutableIntStateOf(0) }
    var selectedOptionIndex by remember { mutableStateOf(-1) }
    var isSubmitted by remember { mutableStateOf(false) }

    // Persistent stats
    var correctCount by remember { mutableStateOf(prefs.getInt("practice_correct", 0)) }
    var totalQuestionsPlayed by remember { mutableStateOf(prefs.getInt("practice_attempted", 0)) }
    var isSynced by remember { mutableStateOf(prefs.getBoolean("practice_synced", true)) }

    // Quiz options for the current question
    var currentOptions by remember { mutableStateOf<List<String>>(emptyList()) }

    // Load compounds from assets
    LaunchedEffect(Unit) {
        val loaded = try {
            val inputStream: InputStream = context.assets.open("compounds_smiles.json")
            val jsonString = inputStream.bufferedReader().use { it.readText() }
            val type = object : TypeToken<List<Compound>>() {}.type
            gson.fromJson<List<Compound>>(jsonString, type)
        } catch (e: Exception) {
            e.printStackTrace()
            // Fallback list
            listOf(
                Compound("Ethanol", "CCO", listOf("reagent")),
                Compound("Caffeine", "CN1C=NC2=C1C(=O)N(C(=O)N2C)C", listOf("organic")),
                Compound("Aspirin", "CC(=O)Oc1ccccc1C(=O)O", listOf("acid")),
                Compound("Glucose", "OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O", listOf("organic")),
                Compound("Benzene", "c1ccccc1", listOf("aromatic")),
                Compound("Acetic Acid", "CC(=O)O", listOf("acid")),
                Compound("Phenol", "Oc1ccccc1", listOf("aromatic"))
            )
        }
        compoundsList = loaded.shuffled()
    }

    // Prepare options when current question index changes
    LaunchedEffect(compoundsList, currentQuestionIndex) {
        if (compoundsList.isNotEmpty()) {
            val currentCompound = compoundsList[currentQuestionIndex]
            val correctName = currentCompound.name
            val incorrectOptions = compoundsList
                .filter { it.name != correctName }
                .map { it.name }
                .shuffled()
                .take(3)
            currentOptions = (incorrectOptions + correctName).shuffled()
            selectedOptionIndex = -1
            isSubmitted = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBg)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Title Bar
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Chemistry Practice",
                color = TextPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
            // Sync indicator
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(if (isSynced) SuccessGreen.copy(alpha = 0.2f) else AlertAmber.copy(alpha = 0.2f))
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Text(
                    text = if (isSynced) "Synced" else "Pending Sync",
                    color = if (isSynced) SuccessGreen else AlertAmber,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        // Progress indicators
        if (compoundsList.isNotEmpty()) {
            val currentCompound = compoundsList[currentQuestionIndex]

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Question ${currentQuestionIndex + 1} of ${compoundsList.size}",
                    color = TextSecondary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = "Score: $correctCount/$totalQuestionsPlayed",
                    color = AccentBlue,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace
                )
            }

            // SMILES Structure Card
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(DarkSurface)
                    .border(1.dp, DarkBorder, RoundedCornerShape(16.dp))
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = "Identify the compound with SMILES formula:",
                    color = TextTertiary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = currentCompound.smiles,
                    color = AccentBlue,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    textAlign = TextAlign.Center,
                    lineHeight = 22.sp
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Options List
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                currentOptions.forEachIndexed { idx, optionName ->
                    val isCorrectChoice = optionName == currentCompound.name
                    val isSelected = selectedOptionIndex == idx

                    val borderTone = when {
                        isSubmitted && isCorrectChoice -> SuccessGreen
                        isSubmitted && isSelected && !isCorrectChoice -> ErrorRed
                        isSelected -> AccentBlue
                        else -> DarkBorder
                    }

                    val bgTone = when {
                        isSubmitted && isCorrectChoice -> SuccessGreen.copy(alpha = 0.15f)
                        isSubmitted && isSelected && !isCorrectChoice -> ErrorRed.copy(alpha = 0.15f)
                        isSelected -> AccentBlue.copy(alpha = 0.12f)
                        else -> DarkSurface
                    }

                    val textTone = when {
                        isSubmitted && isCorrectChoice -> SuccessGreen
                        isSubmitted && isSelected && !isCorrectChoice -> ErrorRed
                        isSelected -> AccentBlue
                        else -> TextPrimary
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(bgTone)
                            .border(1.dp, borderTone, RoundedCornerShape(10.dp))
                            .clickable(enabled = !isSubmitted) { selectedOptionIndex = idx }
                            .padding(14.dp),
                        contentAlignment = Alignment.CenterStart
                    ) {
                        Text(
                            text = optionName,
                            color = textTone,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // Action Button
            Button(
                onClick = {
                    if (!isSubmitted) {
                        isSubmitted = true
                        
                        val isCorrect = currentOptions[selectedOptionIndex] == currentCompound.name
                        val newCorrect = if (isCorrect) correctCount + 1 else correctCount
                        val newAttempted = totalQuestionsPlayed + 1
                        val newWrong = newAttempted - newCorrect

                        // Update State UI
                        correctCount = newCorrect
                        totalQuestionsPlayed = newAttempted

                        // Save locally
                        prefs.edit()
                            .putInt("practice_correct", newCorrect)
                            .putInt("practice_attempted", newAttempted)
                            .putInt("practice_wrong", newWrong)
                            .putBoolean("practice_synced", false)
                            .apply()
                        
                        isSynced = false

                        // Try to sync instantly if internet is active
                        coroutineScope.launch {
                            val isOnline = NetworkUtils.isInternetAvailable(context)
                            if (isOnline) {
                                val username = sessionManager.userName ?: "Student"
                                val success = ApiClient.syncPracticeProgress(
                                    username = username,
                                    correct = newCorrect,
                                    wrong = newWrong,
                                    attempted = newAttempted
                                )
                                if (success) {
                                    prefs.edit().putBoolean("practice_synced", true).apply()
                                    isSynced = true
                                }
                            }
                        }
                    } else {
                        // Go to next question
                        if (currentQuestionIndex + 1 < compoundsList.size) {
                            currentQuestionIndex++
                        } else {
                            // Restart / Reshuffle
                            compoundsList = compoundsList.shuffled()
                            currentQuestionIndex = 0
                            
                            correctCount = 0
                            totalQuestionsPlayed = 0
                            prefs.edit()
                                .putInt("practice_correct", 0)
                                .putInt("practice_attempted", 0)
                                .putInt("practice_wrong", 0)
                                .putBoolean("practice_synced", true)
                                .apply()
                            
                            isSynced = true
                        }
                    }
                },
                enabled = selectedOptionIndex != -1,
                colors = ButtonDefaults.buttonColors(
                    containerColor = AccentBlue,
                    disabledContainerColor = DarkSurfaceVariant
                ),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
            ) {
                Text(
                    text = if (!isSubmitted) "Submit Answer" else "Next Question",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (selectedOptionIndex == -1) TextTertiary else Color.White
                )
            }
        } else {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = AccentBlue)
            }
        }
    }
}
