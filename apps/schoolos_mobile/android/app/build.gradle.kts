import java.util.Properties

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
val releaseBuildRequested = gradle.startParameter.taskNames.any {
    it.contains("release", ignoreCase = true)
}
val configuredApplicationId = releaseProperties.getProperty("applicationId")
    ?.trim()
    ?.takeIf(String::isNotEmpty)
    ?: "com.example.schoolos_mobile"

if (releaseBuildRequested) {
    val releaseErrors = mutableListOf<String>()
    if (!releasePropertiesFile.exists()) {
        releaseErrors += "android/key.properties is required"
    } else if (missingReleaseProperties.isNotEmpty()) {
        releaseErrors +=
            "android/key.properties is missing: ${missingReleaseProperties.joinToString(", ")}"
    }
    if (configuredApplicationId.contains("example", ignoreCase = true)) {
        releaseErrors += "applicationId must be the owner-approved production identifier"
    }
    val configuredStoreFile = releaseProperties.getProperty("storeFile")?.trim()
    if (!configuredStoreFile.isNullOrEmpty() && !rootProject.file(configuredStoreFile).isFile) {
        releaseErrors += "the configured release storeFile does not exist"
    }
    if (releaseErrors.isNotEmpty()) {
        throw GradleException(
            "SchoolOS Android release configuration failed:\n- " +
                releaseErrors.joinToString("\n- "),
        )
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
        // Debug/local builds retain the Flutter template ID. Release builds
        // fail closed above unless android/key.properties supplies the
        // owner-approved production identity and signing material.
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
                storeFile = rootProject.file(releaseProperties.getProperty("storeFile"))
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
