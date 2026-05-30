package com.fycoaching.portal.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val DarkBg = Color(0xFF070B14)
val DarkSurface = Color(0xFF0F1628)
val DarkSurfaceVariant = Color(0xFF172038)
val DarkBorder = Color(0xFF263452)

val AccentBlue = Color(0xFF5F8DFF)
val AccentPurple = Color(0xFF7A6DFF)
val SuccessGreen = Color(0xFF22C55E)
val AlertAmber = Color(0xFFF59E0B)
val ErrorRed = Color(0xFFEF4444)

val TextPrimary = Color(0xFFF4F7FF)
val TextSecondary = Color(0xFFB4C2DF)
val TextTertiary = Color(0xFF7F94BB)

private val ColorScheme = darkColorScheme(
    primary = AccentBlue,
    secondary = AccentPurple,
    background = DarkBg,
    surface = DarkSurface,
    surfaceVariant = DarkSurfaceVariant,
    onPrimary = Color.White,
    onSecondary = Color.White,
    onBackground = TextPrimary,
    onSurface = TextPrimary,
    onSurfaceVariant = TextSecondary,
    error = ErrorRed
)

@Composable
fun PortalTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    // We enforce the dark theme directly to match the student portal's default design
    MaterialTheme(
        colorScheme = ColorScheme,
        content = content
    )
}
