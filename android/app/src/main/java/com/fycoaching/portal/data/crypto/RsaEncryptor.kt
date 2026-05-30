package com.fycoaching.portal.data.crypto

import android.util.Base64
import java.security.KeyFactory
import java.security.spec.X509EncodedKeySpec
import javax.crypto.Cipher

object RsaEncryptor {

    private const val LOGIN_PUBLIC_KEY = """
MIIBCgKCAQEA1PKx1sQNhJVUgha5WOGdiRC0i0Td71UEK9enVf71Tw+79R7mdkEWtE4Ybrsr8yiYi0ETB14RjruFwiLk82wcfbcg4gxHDLxaJoEjjNh1YtMsphOaSte+vNpFrVmpqG6/dvxUAgCdK1kQAM530SC+Dui/tjPr8hUoTPgRkQwVZW/ODf7+1+AT9dJjuJSINmC7Llf5ggAQMmxf24wt2S1L9IGBFTJjIdMGFcfNc2eZQMCmbnZsmNdyv/UubCucusesWIhXnqUXfGbwaxFg0cbiqfyiISuE8yywmkPMYEI96pWRuqCBrgympGMC0CNUK2OoJWG/BeFRJ+hccY5Lp6/+6QIDAQAB
"""

    fun encrypt(password: String): String {
        return try {
            val cleanKey = LOGIN_PUBLIC_KEY
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replace("\\s".toRegex(), "")
            val decodedKey = Base64.decode(cleanKey, Base64.DEFAULT)
            
            // Check if key is PKCS#1 DER format (270 bytes, starts with 0x30, 0x82) and convert to X.509 SPKI
            val spkiBytes = if (decodedKey.size == 270 && decodedKey[0] == 0x30.toByte() && decodedKey[1] == 0x82.toByte()) {
                val spkiHeader = byteArrayOf(
                    0x30.toByte(), 0x82.toByte(), 0x01.toByte(), 0x22.toByte(), // Sequence of length 290
                    0x30.toByte(), 0x0d.toByte(), 0x06.toByte(), 0x09.toByte(), // Algorithm Identifier sequence
                    0x2a.toByte(), 0x86.toByte(), 0x48.toByte(), 0x86.toByte(), // OID: 1.2.840.113549.1.1.1
                    0xf7.toByte(), 0x0d.toByte(), 0x01.toByte(), 0x01.toByte(),
                    0x01.toByte(), 0x05.toByte(), 0x00.toByte(), 0x03.toByte(), // Bit String identifier
                    0x82.toByte(), 0x01.toByte(), 0x0f.toByte(), 0x00.toByte()  // Length 271, offset 0
                )
                val combined = ByteArray(spkiHeader.size + decodedKey.size)
                System.arraycopy(spkiHeader, 0, combined, 0, spkiHeader.size)
                System.arraycopy(decodedKey, 0, combined, spkiHeader.size, decodedKey.size)
                combined
            } else {
                decodedKey
            }
            
            val spec = X509EncodedKeySpec(spkiBytes)
            val keyFactory = KeyFactory.getInstance("RSA")
            val pubKey = keyFactory.generatePublic(spec)
            
            val cipher = Cipher.getInstance("RSA/ECB/PKCS1Padding")
            cipher.init(Cipher.ENCRYPT_MODE, pubKey)
            
            val encryptedBytes = cipher.doFinal(password.toByteArray(Charsets.UTF_8))
            Base64.encodeToString(encryptedBytes, Base64.NO_WRAP)
        } catch (e: Exception) {
            e.printStackTrace()
            ""
        }
    }
}
