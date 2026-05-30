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
            
            val spec = X509EncodedKeySpec(decodedKey)
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
