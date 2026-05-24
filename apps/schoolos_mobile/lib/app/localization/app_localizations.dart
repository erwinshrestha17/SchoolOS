import 'package:flutter/material.dart';

class AppLocalizations {
  const AppLocalizations(this.locale);

  final Locale locale;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations) ??
        const AppLocalizations(Locale('en', ''));
  }

  static const _localizedValues = {
    'en': {
      'app_title': 'SchoolOS Mobile',
      'welcome_back': 'Welcome back',
      'sign_in_desc': 'Sign in to continue to SchoolOS Mobile.',
      'tenant_code': 'Tenant code',
      'email_username': 'Email or username',
      'password': 'Password',
      'forgot_password': 'Forgot password?',
      'sign_in': 'Sign in',
      'offline_mode': 'You are offline. Showing cached data.',
      'error_loading': 'Could not load data. Please try again.',
      'no_data': 'No items found.',
    },
    'ne': {
      'app_title': 'स्कुलओएस मोबाइल',
      'welcome_back': 'स्वागत छ',
      'sign_in_desc': 'स्कुलओएस मोबाइलमा जारी राख्न साइन इन गर्नुहोस्।',
      'tenant_code': 'टेनन्ट कोड',
      'email_username': 'इमेल वा प्रयोगकर्ता नाम',
      'password': 'पासवर्ड',
      'forgot_password': 'पासवर्ड बिर्सनुभयो?',
      'sign_in': 'साइन इन गर्नुहोस्',
      'offline_mode': 'तपाईं अफलाइन हुनुहुन्छ। बचत गरिएको डाटा देखाउँदै।',
      'error_loading': 'डाटा लोड गर्न सकिएन। पुन: प्रयास गर्नुहोस्।',
      'no_data': 'कुनै वस्तु भेटिएन।',
    },
  };

  List<String> get supportedLanguages => ['en', 'ne'];

  String translate(String key) {
    final languageCode = locale.languageCode;
    return _localizedValues[languageCode]?[key] ??
        _localizedValues['en']?[key] ??
        key;
  }
}

class AppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const AppLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) => ['en', 'ne'].contains(locale.languageCode);

  @override
  Future<AppLocalizations> load(Locale locale) async {
    return AppLocalizations(locale);
  }

  @override
  bool shouldReload(AppLocalizationsDelegate old) => false;
}
