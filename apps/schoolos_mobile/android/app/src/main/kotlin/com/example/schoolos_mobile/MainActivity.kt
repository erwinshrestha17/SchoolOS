package com.example.schoolos_mobile

import android.content.Intent
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "schoolos_mobile/file_share"
        ).setMethodCallHandler { call, result ->
            if (call.method != "shareFile") {
                result.notImplemented()
                return@setMethodCallHandler
            }

            val path = call.argument<String>("path")
            val mimeType = call.argument<String>("mimeType") ?: "application/octet-stream"
            val subject = call.argument<String>("subject") ?: "Share file"

            if (path.isNullOrBlank()) {
                result.error("missing_path", "File path is required.", null)
                return@setMethodCallHandler
            }

            val file = File(path)
            if (!file.exists()) {
                result.error("missing_file", "File does not exist.", null)
                return@setMethodCallHandler
            }

            val uri = FileProvider.getUriForFile(
                this,
                "${applicationContext.packageName}.fileprovider",
                file
            )
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = mimeType
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, subject)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            startActivity(Intent.createChooser(shareIntent, subject))
            result.success(null)
        }
    }
}
