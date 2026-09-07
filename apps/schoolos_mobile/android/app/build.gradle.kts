import java.util.Properties
import java.security.KeyStore
import java.security.cert.X509Certificate

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val releasePropertiesFile = rootProject.file("key.properties")
val releaseProperties = Properties().apply {
    if (releasePropertiesFile.exists()) {
        releasePropertiesFile.inputStream().use(::load)
    }
}
val releasePropertyNames = listOf(
    "applicationId",
    "storeFile",
    "storePassword",
    "keyAlias",
    "keyPassword",
)
val missingReleaseProperties = releasePropertyNames.filter {
    releaseProperties.getProperty(it).isNullOrBlank()
}
val releaseSigningReady = releasePropertiesFile.exists() && missingReleaseProperties.isEmpty()
val configuredApplicationId = releaseProperties.getProperty("applicationId")
    ?.trim()
    ?.takeIf(String::isNotEmpty)
    ?: "com.example.schoolos_mobile"

val verifySchoolosReleaseConfiguration = tasks.register("verifySchoolosReleaseConfiguration") {
    group = "verification"
    description = "Validate the SchoolOS release identity and upload signing key."
    doLast {
        val releaseErrors = mutableListOf<String>()
        if (!releasePropertiesFile.exists()) {
            releaseErrors += "android/key.properties is required"
        } else if (missingReleaseProperties.isNotEmpty()) {
            releaseErrors +=
                "android/key.properties is missing: ${missingReleaseProperties.joinToString(", ")}"
        }
        if (!Regex("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+").matches(configuredApplicationId) ||
            Regex("example|placeholder|replace|\\.owner\\.", RegexOption.IGNORE_CASE)
                .containsMatchIn(configuredApplicationId)) {
            releaseErrors += "applicationId must be the owner-approved production identifier"
        }
        val configuredStoreFile = releaseProperties.getProperty("storeFile")?.trim()
        if (!configuredStoreFile.isNullOrEmpty() && !rootProject.file(configuredStoreFile).isFile) {
            releaseErrors += "the configured release storeFile does not exist"
        }
        if (releaseErrors.isEmpty()) {
            try {
                val keyStore = KeyStore.getInstance(
                    rootProject.file(configuredStoreFile!!),
                    releaseProperties.getProperty("storePassword").toCharArray(),
                )
                val alias = releaseProperties.getProperty("keyAlias")
                val key = keyStore.getKey(alias, releaseProperties.getProperty("keyPassword").toCharArray())
                val certificate = keyStore.getCertificate(alias) as? X509Certificate
                if (key == null || certificate == null) {
                    releaseErrors += "the configured alias must contain a signing key and certificate"
                } else if (alias.equals("androiddebugkey", ignoreCase = true) ||
                    certificate.subjectX500Principal.name.contains("CN=Android Debug", ignoreCase = true)) {
                    releaseErrors += "Android debug certificates cannot sign a SchoolOS release"
                }
            } catch (_: Exception) {
                // Keystore errors can contain paths or sensitive input; expose no cause.
                releaseErrors += "the release keystore, alias, or passwords could not be verified"
            }
        }
        if (releaseErrors.isNotEmpty()) {
            throw GradleException(
                "SchoolOS Android release configuration failed:\n- " +
                    releaseErrors.joinToString("\n- "),
            )
        }
    }
}

// Wire the actual task graph, including aggregate `assemble`/`bundle` and
// abbreviated Gradle commands. Inspecting requested task names misses these.
tasks.configureEach {
    if (name == "preReleaseBuild" || name == "validateSigningRelease") {
        dependsOn(verifySchoolosReleaseConfiguration)
    }
}

android {
    namespace = "com.example.schoolos_mobile"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }

    defaultConfig {
        // Local builds use the template ID unless an identity is configured.
        // The release task validates identity and signing material before build.
        applicationId = configuredApplicationId
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (releaseSigningReady) {
            create("release") {
                storeFile = rootProject.file(releaseProperties.getProperty("storeFile").trim())
                storePassword = releaseProperties.getProperty("storePassword")
                keyAlias = releaseProperties.getProperty("keyAlias")
                keyPassword = releaseProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            if (releaseSigningReady) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
}
