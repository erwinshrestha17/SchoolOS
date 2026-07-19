// AUTO-GENERATED from /nepal_administrative_data/*.csv — do not hand-edit.
// Regenerate with the (one-off) generator script used during Nepal geography integration.
// Source dataset: states-nepal npm package 0.3.1 (MIT), cross-checked with neplocalgov and
// Government of Nepal portals. Numeric ids are dataset identifiers, not official government codes.

export interface NepalProvinceSeed {
  id: number;
  nameEn: string;
  nameNe: string;
  headquartersEn: string | null;
  headquartersNe: string | null;
}

export interface NepalDistrictSeed {
  id: number;
  provinceId: number;
  nameEn: string;
  nameNe: string;
  headquartersEn: string | null;
  headquartersNe: string | null;
}

export interface NepalLocalLevelTypeSeed {
  id: number;
  code: string;
  slug: string;
  nameEn: string;
  nameNe: string;
}

export interface NepalLocalLevelSeed {
  id: number;
  districtId: number;
  typeId: number;
  nameEn: string;
  nameNe: string;
}

export const NEPAL_GEOGRAPHY_DATASET_KEY = 'nepal-administrative-hierarchy';
export const NEPAL_GEOGRAPHY_DATASET_VERSION = '1.0.0';
export const NEPAL_GEOGRAPHY_GENERATED_ON = '2026-07-18';
export const NEPAL_GEOGRAPHY_SOURCE = 'states-nepal npm package 0.3.1 (MIT), cross-checked with neplocalgov and Government of Nepal portals';
export const NEPAL_GEOGRAPHY_CHECKSUM = '336f8daae5f01e1426ca02ab2201732589614bb8190f9305fa6564a1015f18da';

export const NEPAL_GEOGRAPHY_RECORD_COUNTS = {
  provinces: 7,
  districts: 77,
  localLevelTypes: 4,
  localLevels: 753,
  metropolitanCities: 6,
  subMetropolitanCities: 11,
  municipalities: 276,
  ruralMunicipalities: 460,
} as const;

export const nepalProvinceSeeds: NepalProvinceSeed[] = [
  {
    "id": 1,
    "nameEn": "Koshi Province",
    "nameNe": "कोशी प्रदेश",
    "headquartersEn": "Biratnagar",
    "headquartersNe": "बिराटनगर"
  },
  {
    "id": 2,
    "nameEn": "Madhesh Province",
    "nameNe": "मधेश प्रदेश",
    "headquartersEn": "Janakpur",
    "headquartersNe": "जनकपुर"
  },
  {
    "id": 3,
    "nameEn": "Bagmati Province",
    "nameNe": "बागमती प्रदेश",
    "headquartersEn": "Hetauda",
    "headquartersNe": "हेटौडा"
  },
  {
    "id": 4,
    "nameEn": "Gandaki Province",
    "nameNe": "गण्डकी प्रदेश",
    "headquartersEn": "Pokhara",
    "headquartersNe": "पोखरा"
  },
  {
    "id": 5,
    "nameEn": "Lumbini Province",
    "nameNe": "लुम्बिनी प्रदेश",
    "headquartersEn": "Deukhuri",
    "headquartersNe": "देउखुरी"
  },
  {
    "id": 6,
    "nameEn": "Karnali Province",
    "nameNe": "कर्णाली प्रदेश",
    "headquartersEn": "Birendranagar",
    "headquartersNe": "बिरेन्द्रनगर"
  },
  {
    "id": 7,
    "nameEn": "Sudurpashchim Province",
    "nameNe": "सुदूरपश्चिम प्रदेश",
    "headquartersEn": "Godawari",
    "headquartersNe": "गोदावरी"
  }
];

export const nepalDistrictSeeds: NepalDistrictSeed[] = [
  {
    "id": 1,
    "provinceId": 1,
    "nameEn": "Bhojpur",
    "nameNe": "भोजपुर",
    "headquartersEn": "Bhojpur",
    "headquartersNe": "भोजपुर"
  },
  {
    "id": 2,
    "provinceId": 1,
    "nameEn": "Dhankuta",
    "nameNe": "धनकुटा",
    "headquartersEn": "Dhankuta",
    "headquartersNe": "धनकुटा"
  },
  {
    "id": 3,
    "provinceId": 1,
    "nameEn": "Ilam",
    "nameNe": "इलाम",
    "headquartersEn": "Ilam",
    "headquartersNe": "ईलाम"
  },
  {
    "id": 4,
    "provinceId": 1,
    "nameEn": "Jhapa",
    "nameNe": "झापा",
    "headquartersEn": "Bhadrapur",
    "headquartersNe": "झापा"
  },
  {
    "id": 5,
    "provinceId": 1,
    "nameEn": "Khotang",
    "nameNe": "खोटाँग",
    "headquartersEn": "Diktel",
    "headquartersNe": "खोटांग"
  },
  {
    "id": 6,
    "provinceId": 1,
    "nameEn": "Morang",
    "nameNe": "मोरंग",
    "headquartersEn": "Biratnagar",
    "headquartersNe": "मोरंग"
  },
  {
    "id": 7,
    "provinceId": 1,
    "nameEn": "Okhaldhunga",
    "nameNe": "ओखलढुंगा",
    "headquartersEn": "Siddhicharan",
    "headquartersNe": "सिद्धिचरण"
  },
  {
    "id": 8,
    "provinceId": 1,
    "nameEn": "Panchthar",
    "nameNe": "पांचथर",
    "headquartersEn": "Phidim",
    "headquartersNe": "फिदिम"
  },
  {
    "id": 9,
    "provinceId": 1,
    "nameEn": "Sankhuwasabha",
    "nameNe": "संखुवासभा",
    "headquartersEn": "Khandbari",
    "headquartersNe": "खाँदबारी"
  },
  {
    "id": 10,
    "provinceId": 1,
    "nameEn": "Solukhumbu",
    "nameNe": "सोलुखुम्बू",
    "headquartersEn": "Salleri",
    "headquartersNe": "सल्लेरी"
  },
  {
    "id": 11,
    "provinceId": 1,
    "nameEn": "Sunsari",
    "nameNe": "सुनसरी",
    "headquartersEn": "Inaruwa",
    "headquartersNe": "इनरुवा"
  },
  {
    "id": 12,
    "provinceId": 1,
    "nameEn": "Taplejung",
    "nameNe": "ताप्लेजुंग",
    "headquartersEn": "Taplejung",
    "headquartersNe": "ताप्लेजुंग"
  },
  {
    "id": 13,
    "provinceId": 1,
    "nameEn": "Terhathum",
    "nameNe": "तेह्रथुम",
    "headquartersEn": "Myanglung",
    "headquartersNe": "म्यांगलुङ्ग"
  },
  {
    "id": 14,
    "provinceId": 1,
    "nameEn": "Udayapur",
    "nameNe": "उदयपुर",
    "headquartersEn": "Gaighat",
    "headquartersNe": "गाईघाट"
  },
  {
    "id": 15,
    "provinceId": 2,
    "nameEn": "Parsa",
    "nameNe": "पर्सा",
    "headquartersEn": "Birgunj",
    "headquartersNe": "विरगंज"
  },
  {
    "id": 16,
    "provinceId": 2,
    "nameEn": "Bara",
    "nameNe": "बारा",
    "headquartersEn": "Kalaiya",
    "headquartersNe": "कलैया"
  },
  {
    "id": 17,
    "provinceId": 2,
    "nameEn": "Rautahat",
    "nameNe": "रौतहट",
    "headquartersEn": "Gaur",
    "headquartersNe": "गौर"
  },
  {
    "id": 18,
    "provinceId": 2,
    "nameEn": "Sarlahi",
    "nameNe": "सर्लाही",
    "headquartersEn": "Malangawa",
    "headquartersNe": "मलंगवा"
  },
  {
    "id": 19,
    "provinceId": 2,
    "nameEn": "Siraha",
    "nameNe": "सिराहा",
    "headquartersEn": "Siraha",
    "headquartersNe": "सिरहा"
  },
  {
    "id": 20,
    "provinceId": 2,
    "nameEn": "Dhanusha",
    "nameNe": "धनुषा",
    "headquartersEn": "Janakpur",
    "headquartersNe": "जनकपुर"
  },
  {
    "id": 21,
    "provinceId": 2,
    "nameEn": "Saptari",
    "nameNe": "सप्तरी",
    "headquartersEn": "Rajbiraj",
    "headquartersNe": "राजविराज"
  },
  {
    "id": 22,
    "provinceId": 2,
    "nameEn": "Mahottari",
    "nameNe": "महोत्तरी",
    "headquartersEn": "Jaleshwar",
    "headquartersNe": "जलेश्वर"
  },
  {
    "id": 23,
    "provinceId": 3,
    "nameEn": "Bhaktapur",
    "nameNe": "भक्तपुर",
    "headquartersEn": "Bhaktapur",
    "headquartersNe": "भक्तपुर"
  },
  {
    "id": 24,
    "provinceId": 3,
    "nameEn": "Chitwan",
    "nameNe": "चितवन",
    "headquartersEn": "Bharatpur",
    "headquartersNe": "भरतपुर"
  },
  {
    "id": 25,
    "provinceId": 3,
    "nameEn": "Dhading",
    "nameNe": "धादिंङ्ग",
    "headquartersEn": "Nilkantha",
    "headquartersNe": "निलकण्ठ"
  },
  {
    "id": 26,
    "provinceId": 3,
    "nameEn": "Dolakha",
    "nameNe": "दोलखा",
    "headquartersEn": "Bhimeshwar",
    "headquartersNe": "भिमेश्वर"
  },
  {
    "id": 27,
    "provinceId": 3,
    "nameEn": "Kathmandu",
    "nameNe": "काठमाडौँ",
    "headquartersEn": "Kathmandu",
    "headquartersNe": "काठमाडौँ"
  },
  {
    "id": 28,
    "provinceId": 3,
    "nameEn": "Kavrepalanchok",
    "nameNe": "काभ्रेपलान्चोक",
    "headquartersEn": "Dhulikhel",
    "headquartersNe": "धुलिखेल"
  },
  {
    "id": 29,
    "provinceId": 3,
    "nameEn": "Lalitpur",
    "nameNe": "ललितपुर",
    "headquartersEn": "Lalitpur",
    "headquartersNe": "ललितपुर"
  },
  {
    "id": 30,
    "provinceId": 3,
    "nameEn": "Makwanpur",
    "nameNe": "मकवानपुर",
    "headquartersEn": "Hetauda",
    "headquartersNe": "हेटौडा"
  },
  {
    "id": 31,
    "provinceId": 3,
    "nameEn": "Nuwakot",
    "nameNe": "नुवाकोट",
    "headquartersEn": "Bidur",
    "headquartersNe": "बिदुर"
  },
  {
    "id": 32,
    "provinceId": 3,
    "nameEn": "Ramechhap",
    "nameNe": "रामेछाप",
    "headquartersEn": "Manthali",
    "headquartersNe": "मन्थली"
  },
  {
    "id": 33,
    "provinceId": 3,
    "nameEn": "Rasuwa",
    "nameNe": "रसुवा",
    "headquartersEn": "Dhunche",
    "headquartersNe": "धुन्चे"
  },
  {
    "id": 34,
    "provinceId": 3,
    "nameEn": "Sindhuli",
    "nameNe": "सिन्धुली",
    "headquartersEn": "Kamalamai",
    "headquartersNe": "कमलामाई"
  },
  {
    "id": 35,
    "provinceId": 3,
    "nameEn": "Sindhupalchok",
    "nameNe": "सिन्धुपाल्चोक",
    "headquartersEn": "Chautara",
    "headquartersNe": "चौतारा"
  },
  {
    "id": 36,
    "provinceId": 4,
    "nameEn": "Baglung",
    "nameNe": "बागलुङ",
    "headquartersEn": "Baglung",
    "headquartersNe": "बाग्लुंग"
  },
  {
    "id": 37,
    "provinceId": 4,
    "nameEn": "Gorkha",
    "nameNe": "गोरखा",
    "headquartersEn": "Gorkha",
    "headquartersNe": "गोर्खा"
  },
  {
    "id": 38,
    "provinceId": 4,
    "nameEn": "Kaski",
    "nameNe": "कास्की",
    "headquartersEn": "Pokhara",
    "headquartersNe": "पोखरा"
  },
  {
    "id": 39,
    "provinceId": 4,
    "nameEn": "Lamjung",
    "nameNe": "लमजुङ",
    "headquartersEn": "Besisahar",
    "headquartersNe": "बेशीसहर"
  },
  {
    "id": 40,
    "provinceId": 4,
    "nameEn": "Manang",
    "nameNe": "मनाङ",
    "headquartersEn": "Chame",
    "headquartersNe": "चामे"
  },
  {
    "id": 41,
    "provinceId": 4,
    "nameEn": "Mustang",
    "nameNe": "मुस्ताङ",
    "headquartersEn": "Jomsom",
    "headquartersNe": "जोमसोम"
  },
  {
    "id": 42,
    "provinceId": 4,
    "nameEn": "Myagdi",
    "nameNe": "म्याग्दी",
    "headquartersEn": "Beni",
    "headquartersNe": "बेनी"
  },
  {
    "id": 43,
    "provinceId": 4,
    "nameEn": "Nawalpur",
    "nameNe": "नवलपुर",
    "headquartersEn": "Kawasoti",
    "headquartersNe": "कावासोती"
  },
  {
    "id": 44,
    "provinceId": 4,
    "nameEn": "Parbat",
    "nameNe": "पर्वत",
    "headquartersEn": "Kusma",
    "headquartersNe": "कुस्मा"
  },
  {
    "id": 45,
    "provinceId": 4,
    "nameEn": "Syangja",
    "nameNe": "स्याङग्जा",
    "headquartersEn": "Putalibazar",
    "headquartersNe": "पुतलीबजार"
  },
  {
    "id": 46,
    "provinceId": 4,
    "nameEn": "Tanahun",
    "nameNe": "तनहुँ",
    "headquartersEn": "Damauli",
    "headquartersNe": "दमौली"
  },
  {
    "id": 47,
    "provinceId": 5,
    "nameEn": "Kapilvastu",
    "nameNe": "कपिलवस्तु",
    "headquartersEn": "Taulihawa",
    "headquartersNe": "तौलिहवा"
  },
  {
    "id": 48,
    "provinceId": 5,
    "nameEn": "Parasi",
    "nameNe": "परासी",
    "headquartersEn": "Ramgram",
    "headquartersNe": "रामग्राम"
  },
  {
    "id": 49,
    "provinceId": 5,
    "nameEn": "Rupandehi",
    "nameNe": "रुपन्देही",
    "headquartersEn": "Siddharthanagar",
    "headquartersNe": "सिद्धार्थनगर"
  },
  {
    "id": 50,
    "provinceId": 5,
    "nameEn": "Arghakhanchi",
    "nameNe": "अर्घाखाँची",
    "headquartersEn": "Sandhikharka",
    "headquartersNe": "सन्धिखर्क"
  },
  {
    "id": 51,
    "provinceId": 5,
    "nameEn": "Gulmi",
    "nameNe": "गुल्मी",
    "headquartersEn": "Tamghas",
    "headquartersNe": "तम्घास"
  },
  {
    "id": 52,
    "provinceId": 5,
    "nameEn": "Palpa",
    "nameNe": "पाल्पा",
    "headquartersEn": "Tansen",
    "headquartersNe": "तानसेन"
  },
  {
    "id": 53,
    "provinceId": 5,
    "nameEn": "Dang",
    "nameNe": "दाङ",
    "headquartersEn": "Ghorahi",
    "headquartersNe": "घोराही"
  },
  {
    "id": 54,
    "provinceId": 5,
    "nameEn": "Pyuthan",
    "nameNe": "प्युठान",
    "headquartersEn": "Pyuthan",
    "headquartersNe": "प्युठान"
  },
  {
    "id": 55,
    "provinceId": 5,
    "nameEn": "Rolpa",
    "nameNe": "रोल्पा",
    "headquartersEn": "Liwang",
    "headquartersNe": "लिवाङ्ग"
  },
  {
    "id": 56,
    "provinceId": 5,
    "nameEn": "Rukum East",
    "nameNe": "पूर्वी रूकुम",
    "headquartersEn": "Rukumkot",
    "headquartersNe": "रुकुमकोट"
  },
  {
    "id": 57,
    "provinceId": 5,
    "nameEn": "Banke",
    "nameNe": "बाँके",
    "headquartersEn": "Nepalganj",
    "headquartersNe": "नेपालगंज"
  },
  {
    "id": 58,
    "provinceId": 5,
    "nameEn": "Bardiya",
    "nameNe": "बर्दिया",
    "headquartersEn": "Gulariya",
    "headquartersNe": "गुलरिया"
  },
  {
    "id": 59,
    "provinceId": 6,
    "nameEn": "Rukum West",
    "nameNe": "रुकुम पश्चिम",
    "headquartersEn": "Musikot",
    "headquartersNe": "मुसिकोट"
  },
  {
    "id": 60,
    "provinceId": 6,
    "nameEn": "Salyan",
    "nameNe": "सल्यान",
    "headquartersEn": "Salyan",
    "headquartersNe": "सल्यान"
  },
  {
    "id": 61,
    "provinceId": 6,
    "nameEn": "Dolpa",
    "nameNe": "डोल्पा",
    "headquartersEn": "Dunai",
    "headquartersNe": "दुनै"
  },
  {
    "id": 62,
    "provinceId": 6,
    "nameEn": "Humla",
    "nameNe": "हुम्ला",
    "headquartersEn": "Simikot",
    "headquartersNe": "सिमिकोट"
  },
  {
    "id": 63,
    "provinceId": 6,
    "nameEn": "Jumla",
    "nameNe": "जुम्ला",
    "headquartersEn": "Chandannath",
    "headquartersNe": "चन्दननाथ"
  },
  {
    "id": 64,
    "provinceId": 6,
    "nameEn": "Kalikot",
    "nameNe": "कालिकोट",
    "headquartersEn": "Manma",
    "headquartersNe": "मान्म"
  },
  {
    "id": 65,
    "provinceId": 6,
    "nameEn": "Mugu",
    "nameNe": "मुगु",
    "headquartersEn": "Gamgadhi",
    "headquartersNe": "गमगढी"
  },
  {
    "id": 66,
    "provinceId": 6,
    "nameEn": "Surkhet",
    "nameNe": "सुर्खेत",
    "headquartersEn": "Birendranagar",
    "headquartersNe": "बिरेन्द्रनगर"
  },
  {
    "id": 67,
    "provinceId": 6,
    "nameEn": "Dailekh",
    "nameNe": "दैलेख",
    "headquartersEn": "Dailekh",
    "headquartersNe": "दैलेख"
  },
  {
    "id": 68,
    "provinceId": 6,
    "nameEn": "Jajarkot",
    "nameNe": "जाजरकोट",
    "headquartersEn": "Khalanga",
    "headquartersNe": "खलंगा"
  },
  {
    "id": 69,
    "provinceId": 7,
    "nameEn": "Darchula",
    "nameNe": "दार्चुला",
    "headquartersEn": "Darchula",
    "headquartersNe": "दार्चुला"
  },
  {
    "id": 70,
    "provinceId": 7,
    "nameEn": "Bajhang",
    "nameNe": "बझाङ",
    "headquartersEn": "Jayaprithvi",
    "headquartersNe": "जयप्रिथिवी"
  },
  {
    "id": 71,
    "provinceId": 7,
    "nameEn": "Bajura",
    "nameNe": "बाजुरा",
    "headquartersEn": "Badimalika",
    "headquartersNe": "बडिमालिका"
  },
  {
    "id": 72,
    "provinceId": 7,
    "nameEn": "Baitadi",
    "nameNe": "बैतडी",
    "headquartersEn": "Dasharathchand",
    "headquartersNe": "दशरथचन्द"
  },
  {
    "id": 73,
    "provinceId": 7,
    "nameEn": "Doti",
    "nameNe": "डोटी",
    "headquartersEn": "Dipayal Silgadhi",
    "headquartersNe": "दिपायल सिलगढी"
  },
  {
    "id": 74,
    "provinceId": 7,
    "nameEn": "Achham",
    "nameNe": "अछाम",
    "headquartersEn": "Mangalsen",
    "headquartersNe": "मंगलसेन"
  },
  {
    "id": 75,
    "provinceId": 7,
    "nameEn": "Dadeldhura",
    "nameNe": "डडेलधुरा",
    "headquartersEn": "Amargadhi",
    "headquartersNe": "अमरगढी"
  },
  {
    "id": 76,
    "provinceId": 7,
    "nameEn": "Kanchanpur",
    "nameNe": "कञ्चनपुर",
    "headquartersEn": "Bheemdatta",
    "headquartersNe": "भीमदत्त"
  },
  {
    "id": 77,
    "provinceId": 7,
    "nameEn": "Kailali",
    "nameNe": "कैलाली",
    "headquartersEn": "Dhangadhi",
    "headquartersNe": "धनगढी"
  }
];

export const nepalLocalLevelTypeSeeds: NepalLocalLevelTypeSeed[] = [
  {
    "id": 1,
    "code": "METROPOLITAN_CITY",
    "slug": "metropolitan-city",
    "nameEn": "Metropolitan City",
    "nameNe": "महानगरपालिका"
  },
  {
    "id": 2,
    "code": "SUB_METROPOLITAN_CITY",
    "slug": "sub-metropolitan-city",
    "nameEn": "Sub-Metropolitan City",
    "nameNe": "उपमहानगरपालिका"
  },
  {
    "id": 3,
    "code": "MUNICIPALITY",
    "slug": "municipality",
    "nameEn": "Municipality",
    "nameNe": "नगरपालिका"
  },
  {
    "id": 4,
    "code": "RURAL_MUNICIPALITY",
    "slug": "rural-municipality",
    "nameEn": "Rural Municipality",
    "nameNe": "गाउँपालिका"
  }
];

export const nepalLocalLevelSeeds: NepalLocalLevelSeed[] = [
  {
    "id": 1,
    "districtId": 1,
    "typeId": 3,
    "nameEn": "Shadanand",
    "nameNe": "षडानन्द"
  },
  {
    "id": 2,
    "districtId": 1,
    "typeId": 3,
    "nameEn": "Bhojpur",
    "nameNe": "भोजपुर"
  },
  {
    "id": 3,
    "districtId": 1,
    "typeId": 4,
    "nameEn": "Hatuwagadhi",
    "nameNe": "हतुवागढी"
  },
  {
    "id": 4,
    "districtId": 1,
    "typeId": 4,
    "nameEn": "Ramprasad Rai",
    "nameNe": "रामप्रसाद राई"
  },
  {
    "id": 5,
    "districtId": 1,
    "typeId": 4,
    "nameEn": "Aamchok",
    "nameNe": "आमचोक"
  },
  {
    "id": 6,
    "districtId": 1,
    "typeId": 4,
    "nameEn": "Tyamke Maiyum",
    "nameNe": "टेम्केमैयुङ"
  },
  {
    "id": 7,
    "districtId": 1,
    "typeId": 4,
    "nameEn": "Arun",
    "nameNe": "अरुण"
  },
  {
    "id": 8,
    "districtId": 1,
    "typeId": 4,
    "nameEn": "Pauwadungma",
    "nameNe": "पौवादुङमा"
  },
  {
    "id": 9,
    "districtId": 1,
    "typeId": 4,
    "nameEn": "Salpasilichho",
    "nameNe": "साल्पासिलिछो"
  },
  {
    "id": 10,
    "districtId": 2,
    "typeId": 3,
    "nameEn": "Dhankuta",
    "nameNe": "धनकुटा"
  },
  {
    "id": 11,
    "districtId": 2,
    "typeId": 3,
    "nameEn": "Pakhribas",
    "nameNe": "पाख्रिबास"
  },
  {
    "id": 12,
    "districtId": 2,
    "typeId": 3,
    "nameEn": "Mahalaxmi",
    "nameNe": "महालक्ष्मी"
  },
  {
    "id": 13,
    "districtId": 2,
    "typeId": 4,
    "nameEn": "Sangurigadhi",
    "nameNe": "साँगुरीगढी"
  },
  {
    "id": 14,
    "districtId": 2,
    "typeId": 4,
    "nameEn": "Chaubise",
    "nameNe": "चौविसे"
  },
  {
    "id": 15,
    "districtId": 2,
    "typeId": 4,
    "nameEn": "Sahidbhumi",
    "nameNe": "सहिदभूमि"
  },
  {
    "id": 16,
    "districtId": 2,
    "typeId": 4,
    "nameEn": "Chhathar Jorpati",
    "nameNe": "छथर जोरपाटी"
  },
  {
    "id": 17,
    "districtId": 3,
    "typeId": 3,
    "nameEn": "Suryodaya",
    "nameNe": "सूर्योदय"
  },
  {
    "id": 18,
    "districtId": 3,
    "typeId": 3,
    "nameEn": "Ilam",
    "nameNe": "ईलाम"
  },
  {
    "id": 19,
    "districtId": 3,
    "typeId": 3,
    "nameEn": "Deumai",
    "nameNe": "देउमाई"
  },
  {
    "id": 20,
    "districtId": 3,
    "typeId": 4,
    "nameEn": "Maijogmai",
    "nameNe": "माईजोगमाई"
  },
  {
    "id": 21,
    "districtId": 3,
    "typeId": 4,
    "nameEn": "Phakphokthum",
    "nameNe": "फाकफोकथुम"
  },
  {
    "id": 22,
    "districtId": 3,
    "typeId": 3,
    "nameEn": "Mai",
    "nameNe": "माई"
  },
  {
    "id": 23,
    "districtId": 3,
    "typeId": 4,
    "nameEn": "Chulachuli",
    "nameNe": "चुलाचुली"
  },
  {
    "id": 24,
    "districtId": 3,
    "typeId": 4,
    "nameEn": "Rong",
    "nameNe": "रोङ"
  },
  {
    "id": 25,
    "districtId": 3,
    "typeId": 4,
    "nameEn": "Mangsebung",
    "nameNe": "माङसेबुङ"
  },
  {
    "id": 26,
    "districtId": 3,
    "typeId": 4,
    "nameEn": "Sandakpur",
    "nameNe": "सन्दकपुर"
  },
  {
    "id": 27,
    "districtId": 4,
    "typeId": 3,
    "nameEn": "Mechinagar",
    "nameNe": "मेचीनगर"
  },
  {
    "id": 28,
    "districtId": 4,
    "typeId": 3,
    "nameEn": "Birtamod",
    "nameNe": "विर्तामोड"
  },
  {
    "id": 29,
    "districtId": 4,
    "typeId": 3,
    "nameEn": "Damak",
    "nameNe": "दमक"
  },
  {
    "id": 30,
    "districtId": 4,
    "typeId": 3,
    "nameEn": "Bhadrapur",
    "nameNe": "भद्रपुर"
  },
  {
    "id": 31,
    "districtId": 4,
    "typeId": 3,
    "nameEn": "Shivasatakshi",
    "nameNe": "शिवशताक्षी"
  },
  {
    "id": 32,
    "districtId": 4,
    "typeId": 3,
    "nameEn": "Arjundhara",
    "nameNe": "अर्जुनधारा"
  },
  {
    "id": 33,
    "districtId": 4,
    "typeId": 3,
    "nameEn": "Gauradaha",
    "nameNe": "गौरादह"
  },
  {
    "id": 34,
    "districtId": 4,
    "typeId": 3,
    "nameEn": "Kankai",
    "nameNe": "कन्काई"
  },
  {
    "id": 35,
    "districtId": 4,
    "typeId": 4,
    "nameEn": "Kamal",
    "nameNe": "कमल"
  },
  {
    "id": 36,
    "districtId": 4,
    "typeId": 4,
    "nameEn": "Buddha Shanti",
    "nameNe": "बुद्धशान्ति"
  },
  {
    "id": 37,
    "districtId": 4,
    "typeId": 4,
    "nameEn": "Kachankawal",
    "nameNe": "कचनकवल"
  },
  {
    "id": 38,
    "districtId": 4,
    "typeId": 4,
    "nameEn": "Jhapa",
    "nameNe": "झापा"
  },
  {
    "id": 39,
    "districtId": 4,
    "typeId": 4,
    "nameEn": "Barhadashi",
    "nameNe": "बाह्रदशी"
  },
  {
    "id": 40,
    "districtId": 4,
    "typeId": 4,
    "nameEn": "Gaurigunj",
    "nameNe": "गौरीगंज"
  },
  {
    "id": 41,
    "districtId": 4,
    "typeId": 4,
    "nameEn": "Haldibari",
    "nameNe": "हल्दिवारी"
  },
  {
    "id": 42,
    "districtId": 5,
    "typeId": 3,
    "nameEn": "Diktel Rupakot Majhuwagadhi",
    "nameNe": "दिक्तेल रुपाकोट मझुवागढी"
  },
  {
    "id": 43,
    "districtId": 5,
    "typeId": 3,
    "nameEn": "Halesi Tuwachung",
    "nameNe": "हलेसी तुवाचुङ"
  },
  {
    "id": 44,
    "districtId": 5,
    "typeId": 4,
    "nameEn": "Khotehang",
    "nameNe": "खोटेहाङ"
  },
  {
    "id": 45,
    "districtId": 5,
    "typeId": 4,
    "nameEn": "Diprung Chuichumma",
    "nameNe": "दिप्रुङ चुइचुम्मा"
  },
  {
    "id": 46,
    "districtId": 5,
    "typeId": 4,
    "nameEn": "Aiselukharka",
    "nameNe": "ऐसेलुखर्क"
  },
  {
    "id": 47,
    "districtId": 5,
    "typeId": 4,
    "nameEn": "Jantedhunga",
    "nameNe": "जन्तेढुंगा"
  },
  {
    "id": 48,
    "districtId": 5,
    "typeId": 4,
    "nameEn": "Kepilasgadhi",
    "nameNe": "केपिलासगढी"
  },
  {
    "id": 49,
    "districtId": 5,
    "typeId": 4,
    "nameEn": "Barahpokhari",
    "nameNe": "वराहपोखरी"
  },
  {
    "id": 50,
    "districtId": 5,
    "typeId": 4,
    "nameEn": "Rawa Besi",
    "nameNe": "रावा बेसी"
  },
  {
    "id": 51,
    "districtId": 5,
    "typeId": 4,
    "nameEn": "Sakela",
    "nameNe": "साकेला"
  },
  {
    "id": 52,
    "districtId": 6,
    "typeId": 3,
    "nameEn": "Sundar Haraicha",
    "nameNe": "सुन्दरहरैचा"
  },
  {
    "id": 53,
    "districtId": 6,
    "typeId": 3,
    "nameEn": "Belbari",
    "nameNe": "बेलवारी"
  },
  {
    "id": 54,
    "districtId": 6,
    "typeId": 3,
    "nameEn": "Pathari Shanischare",
    "nameNe": "पथरी शनिश्चरे"
  },
  {
    "id": 55,
    "districtId": 6,
    "typeId": 3,
    "nameEn": "Ratuwamai",
    "nameNe": "रतुवामाई"
  },
  {
    "id": 56,
    "districtId": 6,
    "typeId": 3,
    "nameEn": "Urlabari",
    "nameNe": "उर्लावारी"
  },
  {
    "id": 57,
    "districtId": 6,
    "typeId": 3,
    "nameEn": "Rangeli",
    "nameNe": "रंगेली"
  },
  {
    "id": 58,
    "districtId": 6,
    "typeId": 3,
    "nameEn": "Sunawarshi",
    "nameNe": "सुनवर्षि"
  },
  {
    "id": 59,
    "districtId": 6,
    "typeId": 3,
    "nameEn": "Letang",
    "nameNe": "लेटाङ"
  },
  {
    "id": 60,
    "districtId": 6,
    "typeId": 1,
    "nameEn": "Biratnagar",
    "nameNe": "विराटनगर"
  },
  {
    "id": 61,
    "districtId": 6,
    "typeId": 4,
    "nameEn": "Jahada",
    "nameNe": "जहदा"
  },
  {
    "id": 62,
    "districtId": 6,
    "typeId": 4,
    "nameEn": "Budi Ganga",
    "nameNe": "बुढीगंगा"
  },
  {
    "id": 63,
    "districtId": 6,
    "typeId": 4,
    "nameEn": "Katahari",
    "nameNe": "कटहरी"
  },
  {
    "id": 64,
    "districtId": 6,
    "typeId": 4,
    "nameEn": "Dhanpalthan",
    "nameNe": "धनपालथान"
  },
  {
    "id": 65,
    "districtId": 6,
    "typeId": 4,
    "nameEn": "Kanepokhari",
    "nameNe": "कानेपोखरी"
  },
  {
    "id": 66,
    "districtId": 6,
    "typeId": 4,
    "nameEn": "Gramthan",
    "nameNe": "ग्रामथान"
  },
  {
    "id": 67,
    "districtId": 6,
    "typeId": 4,
    "nameEn": "Kerabari",
    "nameNe": "केरावारी"
  },
  {
    "id": 68,
    "districtId": 6,
    "typeId": 4,
    "nameEn": "Miklajung",
    "nameNe": "मिक्लाजुङ"
  },
  {
    "id": 69,
    "districtId": 7,
    "typeId": 3,
    "nameEn": "Siddhicharan",
    "nameNe": "सिद्दिचरण"
  },
  {
    "id": 70,
    "districtId": 7,
    "typeId": 4,
    "nameEn": "Khiji Demba",
    "nameNe": "खिजिदेम्बा"
  },
  {
    "id": 71,
    "districtId": 7,
    "typeId": 4,
    "nameEn": "Chisankhugadhi",
    "nameNe": "चिशंखुगढी"
  },
  {
    "id": 72,
    "districtId": 7,
    "typeId": 4,
    "nameEn": "Molung",
    "nameNe": "मोलुङ"
  },
  {
    "id": 73,
    "districtId": 7,
    "typeId": 4,
    "nameEn": "Sunkoshi",
    "nameNe": "सुनकोशी"
  },
  {
    "id": 74,
    "districtId": 7,
    "typeId": 4,
    "nameEn": "Champadevi",
    "nameNe": "चम्पादेवी"
  },
  {
    "id": 75,
    "districtId": 7,
    "typeId": 4,
    "nameEn": "Manebhanjyang",
    "nameNe": "मानेभञ्याङ"
  },
  {
    "id": 76,
    "districtId": 7,
    "typeId": 4,
    "nameEn": "Likhu",
    "nameNe": "लिखु"
  },
  {
    "id": 77,
    "districtId": 8,
    "typeId": 3,
    "nameEn": "Phidim",
    "nameNe": "फिदिम"
  },
  {
    "id": 78,
    "districtId": 8,
    "typeId": 4,
    "nameEn": "Miklajung",
    "nameNe": "मिक्लाजुङ"
  },
  {
    "id": 79,
    "districtId": 8,
    "typeId": 4,
    "nameEn": "Phalgunanda",
    "nameNe": "फाल्गुनन्द"
  },
  {
    "id": 80,
    "districtId": 8,
    "typeId": 4,
    "nameEn": "Hilihang",
    "nameNe": "हिलिहाङ"
  },
  {
    "id": 81,
    "districtId": 8,
    "typeId": 4,
    "nameEn": "Phalelung",
    "nameNe": "फालेलुङ"
  },
  {
    "id": 82,
    "districtId": 8,
    "typeId": 4,
    "nameEn": "Yangwarak",
    "nameNe": "याङवरक"
  },
  {
    "id": 83,
    "districtId": 8,
    "typeId": 4,
    "nameEn": "Kummayak",
    "nameNe": "कुम्मायक"
  },
  {
    "id": 84,
    "districtId": 8,
    "typeId": 4,
    "nameEn": "Tumbewa",
    "nameNe": "तुम्बेवा"
  },
  {
    "id": 85,
    "districtId": 9,
    "typeId": 3,
    "nameEn": "Khandbari",
    "nameNe": "खाँदवारी"
  },
  {
    "id": 86,
    "districtId": 9,
    "typeId": 3,
    "nameEn": "Chainpur",
    "nameNe": "चैनपुर"
  },
  {
    "id": 87,
    "districtId": 9,
    "typeId": 3,
    "nameEn": "Dharmadevi",
    "nameNe": "धर्मदेवी"
  },
  {
    "id": 88,
    "districtId": 9,
    "typeId": 3,
    "nameEn": "Panchkhapan",
    "nameNe": "पाँचखपन"
  },
  {
    "id": 89,
    "districtId": 9,
    "typeId": 3,
    "nameEn": "Madi",
    "nameNe": "मादी"
  },
  {
    "id": 90,
    "districtId": 9,
    "typeId": 4,
    "nameEn": "Makalu",
    "nameNe": "मकालु"
  },
  {
    "id": 91,
    "districtId": 9,
    "typeId": 4,
    "nameEn": "Silichong",
    "nameNe": "सिलीचोङ"
  },
  {
    "id": 92,
    "districtId": 9,
    "typeId": 4,
    "nameEn": "Sabhapokhari",
    "nameNe": "सभापोखरी"
  },
  {
    "id": 93,
    "districtId": 9,
    "typeId": 4,
    "nameEn": "Chichila",
    "nameNe": "चिचिला"
  },
  {
    "id": 94,
    "districtId": 9,
    "typeId": 4,
    "nameEn": "BhotKhola",
    "nameNe": "भोटखोला"
  },
  {
    "id": 95,
    "districtId": 10,
    "typeId": 3,
    "nameEn": "Solu Dudhkunda",
    "nameNe": "सोलुदुधकुण्ड"
  },
  {
    "id": 96,
    "districtId": 10,
    "typeId": 4,
    "nameEn": "Mapya Dudhkoshi",
    "nameNe": "माप्य दुधकोशी"
  },
  {
    "id": 97,
    "districtId": 10,
    "typeId": 4,
    "nameEn": "Necha Salyan",
    "nameNe": "नेचासल्यान"
  },
  {
    "id": 98,
    "districtId": 10,
    "typeId": 4,
    "nameEn": "Thulung Dudhkoshi",
    "nameNe": "थुलुङ दुधकोशी"
  },
  {
    "id": 99,
    "districtId": 10,
    "typeId": 4,
    "nameEn": "Maha Kulung",
    "nameNe": "माहाकुलुङ"
  },
  {
    "id": 100,
    "districtId": 10,
    "typeId": 4,
    "nameEn": "Sotang",
    "nameNe": "सोताङ"
  },
  {
    "id": 101,
    "districtId": 10,
    "typeId": 4,
    "nameEn": "Khumbu PasangLhamu",
    "nameNe": "खुम्वु पासाङल्हमु"
  },
  {
    "id": 102,
    "districtId": 10,
    "typeId": 4,
    "nameEn": "Likhu Pike",
    "nameNe": "लिखु पिके"
  },
  {
    "id": 103,
    "districtId": 11,
    "typeId": 3,
    "nameEn": "BarahaKshetra",
    "nameNe": "बराहक्षेत्र"
  },
  {
    "id": 104,
    "districtId": 11,
    "typeId": 3,
    "nameEn": "Inaruwa",
    "nameNe": "ईनरुवा"
  },
  {
    "id": 105,
    "districtId": 11,
    "typeId": 3,
    "nameEn": "Duhabi",
    "nameNe": "दुहवी"
  },
  {
    "id": 106,
    "districtId": 11,
    "typeId": 3,
    "nameEn": "Ramdhuni",
    "nameNe": "रामधुनी"
  },
  {
    "id": 107,
    "districtId": 11,
    "typeId": 2,
    "nameEn": "Itahari",
    "nameNe": "ईटहरी"
  },
  {
    "id": 108,
    "districtId": 11,
    "typeId": 2,
    "nameEn": "Dharan",
    "nameNe": "धरान"
  },
  {
    "id": 109,
    "districtId": 11,
    "typeId": 4,
    "nameEn": "Koshi",
    "nameNe": "कोशी"
  },
  {
    "id": 110,
    "districtId": 11,
    "typeId": 4,
    "nameEn": "Harinagar",
    "nameNe": "हरिनगर"
  },
  {
    "id": 111,
    "districtId": 11,
    "typeId": 4,
    "nameEn": "Bhokraha Narsingh",
    "nameNe": "भोक्राहा नरसिंह"
  },
  {
    "id": 112,
    "districtId": 11,
    "typeId": 4,
    "nameEn": "Dewangunj",
    "nameNe": "देवानगञ्ज"
  },
  {
    "id": 113,
    "districtId": 11,
    "typeId": 4,
    "nameEn": "Gadhi",
    "nameNe": "गढी"
  },
  {
    "id": 114,
    "districtId": 11,
    "typeId": 4,
    "nameEn": "Barju",
    "nameNe": "बर्जु"
  },
  {
    "id": 115,
    "districtId": 12,
    "typeId": 3,
    "nameEn": "Phungling",
    "nameNe": "फुङलिङ"
  },
  {
    "id": 116,
    "districtId": 12,
    "typeId": 4,
    "nameEn": "Sirijangha",
    "nameNe": "सिरीजङ्घा"
  },
  {
    "id": 117,
    "districtId": 12,
    "typeId": 4,
    "nameEn": "Aathrai Triveni",
    "nameNe": "आठराई त्रिवेणी"
  },
  {
    "id": 118,
    "districtId": 12,
    "typeId": 4,
    "nameEn": "Pathibhara Yangwarak",
    "nameNe": "पाथीभरा याङवरक"
  },
  {
    "id": 119,
    "districtId": 12,
    "typeId": 4,
    "nameEn": "Meringden",
    "nameNe": "मेरिङदेन"
  },
  {
    "id": 120,
    "districtId": 12,
    "typeId": 4,
    "nameEn": "Sidingwa",
    "nameNe": "सिदिङ्वा"
  },
  {
    "id": 121,
    "districtId": 12,
    "typeId": 4,
    "nameEn": "Phaktanglung",
    "nameNe": "फक्ताङलुङ"
  },
  {
    "id": 122,
    "districtId": 12,
    "typeId": 4,
    "nameEn": "Maiwa Khola",
    "nameNe": "मैवाखोला"
  },
  {
    "id": 123,
    "districtId": 12,
    "typeId": 4,
    "nameEn": "Mikwa Khola",
    "nameNe": "मिक्वाखोला"
  },
  {
    "id": 124,
    "districtId": 13,
    "typeId": 3,
    "nameEn": "Myanglung",
    "nameNe": "म्याङलुङ"
  },
  {
    "id": 125,
    "districtId": 13,
    "typeId": 3,
    "nameEn": "Laligurans",
    "nameNe": "लालीगुराँस"
  },
  {
    "id": 126,
    "districtId": 13,
    "typeId": 4,
    "nameEn": "Aathrai",
    "nameNe": "आठराई"
  },
  {
    "id": 127,
    "districtId": 13,
    "typeId": 4,
    "nameEn": "Phedap",
    "nameNe": "फेदाप"
  },
  {
    "id": 128,
    "districtId": 13,
    "typeId": 4,
    "nameEn": "Chhathar",
    "nameNe": "छथर"
  },
  {
    "id": 129,
    "districtId": 13,
    "typeId": 4,
    "nameEn": "Menchayayem",
    "nameNe": "मेन्छयायेम"
  },
  {
    "id": 130,
    "districtId": 14,
    "typeId": 3,
    "nameEn": "Triyuga",
    "nameNe": "त्रियुगा"
  },
  {
    "id": 131,
    "districtId": 14,
    "typeId": 3,
    "nameEn": "Katari",
    "nameNe": "कटारी"
  },
  {
    "id": 132,
    "districtId": 14,
    "typeId": 3,
    "nameEn": "Chaudandigadhi",
    "nameNe": "चौदण्डीगढी"
  },
  {
    "id": 133,
    "districtId": 14,
    "typeId": 3,
    "nameEn": "Belaka",
    "nameNe": "वेलका"
  },
  {
    "id": 134,
    "districtId": 14,
    "typeId": 4,
    "nameEn": "Udayapurgadhi",
    "nameNe": "उदयपुरगढी"
  },
  {
    "id": 135,
    "districtId": 14,
    "typeId": 4,
    "nameEn": "Rautamai",
    "nameNe": "रौतामाई"
  },
  {
    "id": 136,
    "districtId": 14,
    "typeId": 4,
    "nameEn": "Tapli",
    "nameNe": "ताप्ली"
  },
  {
    "id": 137,
    "districtId": 14,
    "typeId": 4,
    "nameEn": "Limchungbung",
    "nameNe": "लिम्चुङ्बुङ"
  },
  {
    "id": 138,
    "districtId": 15,
    "typeId": 1,
    "nameEn": "Birgunj",
    "nameNe": "बिरगंज"
  },
  {
    "id": 139,
    "districtId": 15,
    "typeId": 3,
    "nameEn": "Bahudarmai",
    "nameNe": "बहुदरमाई"
  },
  {
    "id": 140,
    "districtId": 15,
    "typeId": 3,
    "nameEn": "Parsagadhi",
    "nameNe": "पर्सागढी"
  },
  {
    "id": 141,
    "districtId": 15,
    "typeId": 3,
    "nameEn": "Pokhariya",
    "nameNe": "पोखरिया"
  },
  {
    "id": 142,
    "districtId": 15,
    "typeId": 4,
    "nameEn": "Bindabasini",
    "nameNe": "बिन्दबासिनी"
  },
  {
    "id": 143,
    "districtId": 15,
    "typeId": 4,
    "nameEn": "Dhobini",
    "nameNe": "धोबीनी"
  },
  {
    "id": 144,
    "districtId": 15,
    "typeId": 4,
    "nameEn": "Chhipaharmai",
    "nameNe": "छिपहरमाई"
  },
  {
    "id": 145,
    "districtId": 15,
    "typeId": 4,
    "nameEn": "Jagarnathpur",
    "nameNe": "जगरनाथपुर"
  },
  {
    "id": 146,
    "districtId": 15,
    "typeId": 4,
    "nameEn": "Jirabhawani",
    "nameNe": "जिरा भवानी"
  },
  {
    "id": 147,
    "districtId": 15,
    "typeId": 4,
    "nameEn": "Kalikamai",
    "nameNe": "कालिकामाई"
  },
  {
    "id": 148,
    "districtId": 15,
    "typeId": 4,
    "nameEn": "Pakaha Mainpur",
    "nameNe": "पकाहा मैनपुर"
  },
  {
    "id": 149,
    "districtId": 15,
    "typeId": 4,
    "nameEn": "Paterwa Sugauli",
    "nameNe": "पटेर्वा सुगौली"
  },
  {
    "id": 150,
    "districtId": 15,
    "typeId": 4,
    "nameEn": "Sakhuwa Prasauni",
    "nameNe": "सखुवा प्रसौनी"
  },
  {
    "id": 151,
    "districtId": 15,
    "typeId": 4,
    "nameEn": "Thori",
    "nameNe": "ठोरी"
  },
  {
    "id": 152,
    "districtId": 16,
    "typeId": 2,
    "nameEn": "Kalaiya",
    "nameNe": "कलैया"
  },
  {
    "id": 153,
    "districtId": 16,
    "typeId": 2,
    "nameEn": "Jitpur Simara",
    "nameNe": "जीतपुर सिमरा"
  },
  {
    "id": 154,
    "districtId": 16,
    "typeId": 3,
    "nameEn": "Kolhabi",
    "nameNe": "कोल्हवी"
  },
  {
    "id": 155,
    "districtId": 16,
    "typeId": 3,
    "nameEn": "Nijgadh",
    "nameNe": "निजगढ"
  },
  {
    "id": 156,
    "districtId": 16,
    "typeId": 3,
    "nameEn": "Mahagadhimai",
    "nameNe": "महागढीमाई"
  },
  {
    "id": 157,
    "districtId": 16,
    "typeId": 3,
    "nameEn": "Simaraungadh",
    "nameNe": "सिम्रौनगढ"
  },
  {
    "id": 158,
    "districtId": 16,
    "typeId": 3,
    "nameEn": "Pacharauta",
    "nameNe": "पचरौता"
  },
  {
    "id": 159,
    "districtId": 16,
    "typeId": 4,
    "nameEn": "Pheta",
    "nameNe": "फेटा"
  },
  {
    "id": 160,
    "districtId": 16,
    "typeId": 4,
    "nameEn": "Bishrampur",
    "nameNe": "विश्रामपुर"
  },
  {
    "id": 161,
    "districtId": 16,
    "typeId": 4,
    "nameEn": "Prasauni",
    "nameNe": "प्रसौनी"
  },
  {
    "id": 162,
    "districtId": 16,
    "typeId": 4,
    "nameEn": "Adarsh Kotwal",
    "nameNe": "आदर्श कोटवाल"
  },
  {
    "id": 163,
    "districtId": 16,
    "typeId": 4,
    "nameEn": "Karaiyamai",
    "nameNe": "करैयामाई"
  },
  {
    "id": 164,
    "districtId": 16,
    "typeId": 4,
    "nameEn": "Devtal",
    "nameNe": "देवताल"
  },
  {
    "id": 165,
    "districtId": 16,
    "typeId": 4,
    "nameEn": "Parwanipur",
    "nameNe": "परवानीपुर"
  },
  {
    "id": 166,
    "districtId": 16,
    "typeId": 4,
    "nameEn": "Baragadhi",
    "nameNe": "बारागढी"
  },
  {
    "id": 167,
    "districtId": 16,
    "typeId": 4,
    "nameEn": "Suwarna",
    "nameNe": "सुवर्ण"
  },
  {
    "id": 168,
    "districtId": 17,
    "typeId": 3,
    "nameEn": "Baudhimai",
    "nameNe": "बौधीमाई"
  },
  {
    "id": 169,
    "districtId": 17,
    "typeId": 3,
    "nameEn": "Brindaban",
    "nameNe": "बृन्दावन"
  },
  {
    "id": 170,
    "districtId": 17,
    "typeId": 3,
    "nameEn": "Chandrapur",
    "nameNe": "चन्द्रपुर"
  },
  {
    "id": 171,
    "districtId": 17,
    "typeId": 3,
    "nameEn": "Dewahi Gonahi",
    "nameNe": "देवाही गोनाही"
  },
  {
    "id": 172,
    "districtId": 17,
    "typeId": 3,
    "nameEn": "Gadhimai",
    "nameNe": "गढीमाई"
  },
  {
    "id": 173,
    "districtId": 17,
    "typeId": 3,
    "nameEn": "Guruda",
    "nameNe": "गरुडा"
  },
  {
    "id": 174,
    "districtId": 17,
    "typeId": 3,
    "nameEn": "Gaur",
    "nameNe": "गौर"
  },
  {
    "id": 175,
    "districtId": 17,
    "typeId": 3,
    "nameEn": "Gujara",
    "nameNe": "गुजरा"
  },
  {
    "id": 176,
    "districtId": 17,
    "typeId": 3,
    "nameEn": "Ishanath",
    "nameNe": "ईशनाथ"
  },
  {
    "id": 177,
    "districtId": 17,
    "typeId": 3,
    "nameEn": "Katahariya",
    "nameNe": "कटहरिया"
  },
  {
    "id": 178,
    "districtId": 17,
    "typeId": 3,
    "nameEn": "Madhav Narayan",
    "nameNe": "माधव नारायण"
  },
  {
    "id": 179,
    "districtId": 17,
    "typeId": 3,
    "nameEn": "Maulapur",
    "nameNe": "मौलापुर"
  },
  {
    "id": 180,
    "districtId": 17,
    "typeId": 3,
    "nameEn": "Paroha",
    "nameNe": "परोहा"
  },
  {
    "id": 181,
    "districtId": 17,
    "typeId": 3,
    "nameEn": "Phatuwa Bijayapur",
    "nameNe": "फतुवाबिजयपुर"
  },
  {
    "id": 182,
    "districtId": 17,
    "typeId": 3,
    "nameEn": "Rajdevi",
    "nameNe": "राजदेवी"
  },
  {
    "id": 183,
    "districtId": 17,
    "typeId": 3,
    "nameEn": "Rajpur",
    "nameNe": "राजपुर"
  },
  {
    "id": 184,
    "districtId": 17,
    "typeId": 4,
    "nameEn": "Durga Bhagwati",
    "nameNe": "दुर्गा भगवती"
  },
  {
    "id": 185,
    "districtId": 17,
    "typeId": 4,
    "nameEn": "Yamunamai",
    "nameNe": "यमुनामाई"
  },
  {
    "id": 186,
    "districtId": 18,
    "typeId": 3,
    "nameEn": "Bagmati",
    "nameNe": "बागमती"
  },
  {
    "id": 187,
    "districtId": 18,
    "typeId": 3,
    "nameEn": "Balara",
    "nameNe": "बलरा"
  },
  {
    "id": 188,
    "districtId": 18,
    "typeId": 3,
    "nameEn": "Barahathwa",
    "nameNe": "बरहथवा"
  },
  {
    "id": 189,
    "districtId": 18,
    "typeId": 3,
    "nameEn": "Godaita",
    "nameNe": "गोडैटा"
  },
  {
    "id": 190,
    "districtId": 18,
    "typeId": 3,
    "nameEn": "Hariwan",
    "nameNe": "हरिवन"
  },
  {
    "id": 191,
    "districtId": 18,
    "typeId": 3,
    "nameEn": "Haripur",
    "nameNe": "हरिपुर"
  },
  {
    "id": 192,
    "districtId": 18,
    "typeId": 3,
    "nameEn": "Haripurwa",
    "nameNe": "हरिपुर्वा"
  },
  {
    "id": 193,
    "districtId": 18,
    "typeId": 3,
    "nameEn": "Ishowrpur",
    "nameNe": "ईश्वरपुर"
  },
  {
    "id": 194,
    "districtId": 18,
    "typeId": 3,
    "nameEn": "Kabilasi",
    "nameNe": "कविलासी"
  },
  {
    "id": 195,
    "districtId": 18,
    "typeId": 3,
    "nameEn": "Lalbandi",
    "nameNe": "लालबन्दी"
  },
  {
    "id": 196,
    "districtId": 18,
    "typeId": 3,
    "nameEn": "Malangawa",
    "nameNe": "मलंगवा"
  },
  {
    "id": 197,
    "districtId": 18,
    "typeId": 4,
    "nameEn": "Basbariya",
    "nameNe": "बसबरीया"
  },
  {
    "id": 198,
    "districtId": 18,
    "typeId": 4,
    "nameEn": "Bisnu",
    "nameNe": "विष्णु"
  },
  {
    "id": 199,
    "districtId": 18,
    "typeId": 4,
    "nameEn": "Brahampuri",
    "nameNe": "ब्रह्मपुरी"
  },
  {
    "id": 200,
    "districtId": 18,
    "typeId": 4,
    "nameEn": "Chakraghatta",
    "nameNe": "चक्रघट्टा"
  },
  {
    "id": 201,
    "districtId": 18,
    "typeId": 4,
    "nameEn": "Chandranagar",
    "nameNe": "चन्द्रनगर"
  },
  {
    "id": 202,
    "districtId": 18,
    "typeId": 4,
    "nameEn": "Dhankaul",
    "nameNe": "धनकौल"
  },
  {
    "id": 203,
    "districtId": 18,
    "typeId": 4,
    "nameEn": "Kaudena",
    "nameNe": "कौडेना"
  },
  {
    "id": 204,
    "districtId": 18,
    "typeId": 4,
    "nameEn": "Parsa",
    "nameNe": "पर्सा"
  },
  {
    "id": 205,
    "districtId": 18,
    "typeId": 4,
    "nameEn": "Ramnagar",
    "nameNe": "रामनगर"
  },
  {
    "id": 206,
    "districtId": 19,
    "typeId": 3,
    "nameEn": "Lahan",
    "nameNe": "लहान"
  },
  {
    "id": 207,
    "districtId": 19,
    "typeId": 3,
    "nameEn": "Dhangadhimai",
    "nameNe": "धनगढीमाई"
  },
  {
    "id": 208,
    "districtId": 19,
    "typeId": 3,
    "nameEn": "Siraha",
    "nameNe": "सिरहा"
  },
  {
    "id": 209,
    "districtId": 19,
    "typeId": 3,
    "nameEn": "Golbazar",
    "nameNe": "गोलबजार"
  },
  {
    "id": 210,
    "districtId": 19,
    "typeId": 3,
    "nameEn": "Mirchaiya",
    "nameNe": "मिर्चैयाँ"
  },
  {
    "id": 211,
    "districtId": 19,
    "typeId": 3,
    "nameEn": "Kalyanpur",
    "nameNe": "कल्याणपुर"
  },
  {
    "id": 212,
    "districtId": 19,
    "typeId": 3,
    "nameEn": "Karjanha",
    "nameNe": "कर्जन्हा"
  },
  {
    "id": 213,
    "districtId": 19,
    "typeId": 3,
    "nameEn": "Sukhipur",
    "nameNe": "सुखीपुर"
  },
  {
    "id": 214,
    "districtId": 19,
    "typeId": 4,
    "nameEn": "Bhagwanpur",
    "nameNe": "भगवानपुर"
  },
  {
    "id": 215,
    "districtId": 19,
    "typeId": 4,
    "nameEn": "Aurahi",
    "nameNe": "औरही"
  },
  {
    "id": 216,
    "districtId": 19,
    "typeId": 4,
    "nameEn": "Bishnupur",
    "nameNe": "विष्णुपुर"
  },
  {
    "id": 217,
    "districtId": 19,
    "typeId": 4,
    "nameEn": "Bariyarpatti",
    "nameNe": "बरियारपट्टी"
  },
  {
    "id": 218,
    "districtId": 19,
    "typeId": 4,
    "nameEn": "Lakshmipur Patari",
    "nameNe": "लक्ष्मीपुर पतारी"
  },
  {
    "id": 219,
    "districtId": 19,
    "typeId": 4,
    "nameEn": "Naraha",
    "nameNe": "नरहा"
  },
  {
    "id": 220,
    "districtId": 19,
    "typeId": 4,
    "nameEn": "SakhuwanankarKatti",
    "nameNe": "सखुवानान्कारकट्टी"
  },
  {
    "id": 221,
    "districtId": 19,
    "typeId": 4,
    "nameEn": "Arnama",
    "nameNe": "अर्नमा"
  },
  {
    "id": 222,
    "districtId": 19,
    "typeId": 4,
    "nameEn": "Navarajpur",
    "nameNe": "नवराजपुर"
  },
  {
    "id": 223,
    "districtId": 20,
    "typeId": 2,
    "nameEn": "Janakpurdham",
    "nameNe": "जनकपुरधाम"
  },
  {
    "id": 224,
    "districtId": 20,
    "typeId": 3,
    "nameEn": "Chhireshwarnath",
    "nameNe": "क्षिरेश्वरनाथ"
  },
  {
    "id": 225,
    "districtId": 20,
    "typeId": 3,
    "nameEn": "Ganeshman Charnath",
    "nameNe": "गणेशमान चारनाथ"
  },
  {
    "id": 226,
    "districtId": 20,
    "typeId": 3,
    "nameEn": "Dhanushadham",
    "nameNe": "धनुषाधाम"
  },
  {
    "id": 227,
    "districtId": 20,
    "typeId": 3,
    "nameEn": "Nagarain",
    "nameNe": "नगराइन"
  },
  {
    "id": 228,
    "districtId": 20,
    "typeId": 3,
    "nameEn": "Bideha",
    "nameNe": "विदेह"
  },
  {
    "id": 229,
    "districtId": 20,
    "typeId": 3,
    "nameEn": "Mithila",
    "nameNe": "मिथिला"
  },
  {
    "id": 230,
    "districtId": 20,
    "typeId": 3,
    "nameEn": "Sahidnagar",
    "nameNe": "शहीदनगर"
  },
  {
    "id": 231,
    "districtId": 20,
    "typeId": 3,
    "nameEn": "Sabaila",
    "nameNe": "सबैला"
  },
  {
    "id": 232,
    "districtId": 20,
    "typeId": 3,
    "nameEn": "Kamala",
    "nameNe": "कमला"
  },
  {
    "id": 233,
    "districtId": 20,
    "typeId": 3,
    "nameEn": "MithilaBihari",
    "nameNe": "मिथिला बिहारी"
  },
  {
    "id": 234,
    "districtId": 20,
    "typeId": 3,
    "nameEn": "Hansapur",
    "nameNe": "हंसपुर"
  },
  {
    "id": 235,
    "districtId": 20,
    "typeId": 4,
    "nameEn": "Janaknandani",
    "nameNe": "जनकनन्दिनी"
  },
  {
    "id": 236,
    "districtId": 20,
    "typeId": 4,
    "nameEn": "Bateshwar",
    "nameNe": "बटेश्वर"
  },
  {
    "id": 237,
    "districtId": 20,
    "typeId": 4,
    "nameEn": "Mukhiyapatti Musharniya",
    "nameNe": "मुखियापट्टी मुसहरमिया"
  },
  {
    "id": 238,
    "districtId": 20,
    "typeId": 4,
    "nameEn": "Lakshminya",
    "nameNe": "लक्ष्मीनिया"
  },
  {
    "id": 239,
    "districtId": 20,
    "typeId": 4,
    "nameEn": "Aaurahi",
    "nameNe": "औरही"
  },
  {
    "id": 240,
    "districtId": 20,
    "typeId": 4,
    "nameEn": "Dhanauji",
    "nameNe": "धनौजी"
  },
  {
    "id": 241,
    "districtId": 21,
    "typeId": 3,
    "nameEn": "Bodebarsain",
    "nameNe": "बोदेबरसाईन"
  },
  {
    "id": 242,
    "districtId": 21,
    "typeId": 3,
    "nameEn": "Dakneshwori",
    "nameNe": "डाक्नेश्वरी"
  },
  {
    "id": 243,
    "districtId": 21,
    "typeId": 3,
    "nameEn": "Hanumannagar Kankalini",
    "nameNe": "हनुमाननगर कङ्‌कालिनी"
  },
  {
    "id": 244,
    "districtId": 21,
    "typeId": 3,
    "nameEn": "Kanchanrup",
    "nameNe": "कञ्चनरुप"
  },
  {
    "id": 245,
    "districtId": 21,
    "typeId": 3,
    "nameEn": "Khadak",
    "nameNe": "खडक"
  },
  {
    "id": 246,
    "districtId": 21,
    "typeId": 3,
    "nameEn": "Shambhunath",
    "nameNe": "शम्भुनाथ"
  },
  {
    "id": 247,
    "districtId": 21,
    "typeId": 3,
    "nameEn": "Saptakoshi",
    "nameNe": "सप्तकोशी"
  },
  {
    "id": 248,
    "districtId": 21,
    "typeId": 3,
    "nameEn": "Surunga",
    "nameNe": "सुरुङ्‍गा"
  },
  {
    "id": 249,
    "districtId": 21,
    "typeId": 3,
    "nameEn": "Rajbiraj",
    "nameNe": "राजविराज"
  },
  {
    "id": 250,
    "districtId": 21,
    "typeId": 4,
    "nameEn": "Agnisaira Krishnasavaran",
    "nameNe": "अग्निसाइर कृष्णासरवन"
  },
  {
    "id": 251,
    "districtId": 21,
    "typeId": 4,
    "nameEn": "Balan-Bihul",
    "nameNe": "बलान-बिहुल"
  },
  {
    "id": 252,
    "districtId": 21,
    "typeId": 4,
    "nameEn": "Rajgadh",
    "nameNe": "राजगढ"
  },
  {
    "id": 253,
    "districtId": 21,
    "typeId": 4,
    "nameEn": "Bishnupur",
    "nameNe": "बिष्णुपुर"
  },
  {
    "id": 254,
    "districtId": 21,
    "typeId": 4,
    "nameEn": "Chhinnamasta",
    "nameNe": "छिन्नमस्ता"
  },
  {
    "id": 255,
    "districtId": 21,
    "typeId": 4,
    "nameEn": "Mahadeva",
    "nameNe": "महादेवा"
  },
  {
    "id": 256,
    "districtId": 21,
    "typeId": 4,
    "nameEn": "Rupani",
    "nameNe": "रुपनी"
  },
  {
    "id": 257,
    "districtId": 21,
    "typeId": 4,
    "nameEn": "Tilathi Koiladi",
    "nameNe": "तिलाठी कोईलाडी"
  },
  {
    "id": 258,
    "districtId": 21,
    "typeId": 4,
    "nameEn": "Tirhut",
    "nameNe": "तिरहुत"
  },
  {
    "id": 259,
    "districtId": 22,
    "typeId": 3,
    "nameEn": "Aaurahi",
    "nameNe": "औरही"
  },
  {
    "id": 260,
    "districtId": 22,
    "typeId": 3,
    "nameEn": "Balawa",
    "nameNe": "बलवा"
  },
  {
    "id": 261,
    "districtId": 22,
    "typeId": 3,
    "nameEn": "Bardibas",
    "nameNe": "बर्दिबास"
  },
  {
    "id": 262,
    "districtId": 22,
    "typeId": 3,
    "nameEn": "Bhangaha",
    "nameNe": "भँगाहा"
  },
  {
    "id": 263,
    "districtId": 22,
    "typeId": 3,
    "nameEn": "Gaushala",
    "nameNe": "गौशाला"
  },
  {
    "id": 264,
    "districtId": 22,
    "typeId": 3,
    "nameEn": "Jaleshor",
    "nameNe": "जलेश्वर"
  },
  {
    "id": 265,
    "districtId": 22,
    "typeId": 3,
    "nameEn": "Loharpatti",
    "nameNe": "लोहरपट्टी"
  },
  {
    "id": 266,
    "districtId": 22,
    "typeId": 3,
    "nameEn": "Manara Shiswa",
    "nameNe": "मनरा शिसवा"
  },
  {
    "id": 267,
    "districtId": 22,
    "typeId": 3,
    "nameEn": "Matihani",
    "nameNe": "मटिहानी"
  },
  {
    "id": 268,
    "districtId": 22,
    "typeId": 3,
    "nameEn": "Ramgopalpur",
    "nameNe": "रामगोपालपुर"
  },
  {
    "id": 269,
    "districtId": 22,
    "typeId": 4,
    "nameEn": "Ekdara",
    "nameNe": "एकडारा"
  },
  {
    "id": 270,
    "districtId": 22,
    "typeId": 4,
    "nameEn": "Mahottari",
    "nameNe": "महोत्तरी"
  },
  {
    "id": 271,
    "districtId": 22,
    "typeId": 4,
    "nameEn": "Pipara",
    "nameNe": "पिपरा"
  },
  {
    "id": 272,
    "districtId": 22,
    "typeId": 4,
    "nameEn": "Samsi",
    "nameNe": "साम्सी"
  },
  {
    "id": 273,
    "districtId": 22,
    "typeId": 4,
    "nameEn": "Sonama",
    "nameNe": "सोनमा"
  },
  {
    "id": 274,
    "districtId": 23,
    "typeId": 3,
    "nameEn": "Bhaktapur",
    "nameNe": "भक्तपुर"
  },
  {
    "id": 275,
    "districtId": 23,
    "typeId": 3,
    "nameEn": "Changunarayan",
    "nameNe": "चाँगुनारायण"
  },
  {
    "id": 276,
    "districtId": 23,
    "typeId": 3,
    "nameEn": "Suryabinayak",
    "nameNe": "सूर्यविनायक"
  },
  {
    "id": 277,
    "districtId": 23,
    "typeId": 3,
    "nameEn": "Madhyapur Thimi",
    "nameNe": "मध्यपुर थिमी"
  },
  {
    "id": 278,
    "districtId": 24,
    "typeId": 1,
    "nameEn": "Bharatpur",
    "nameNe": "भरतपुर"
  },
  {
    "id": 279,
    "districtId": 24,
    "typeId": 3,
    "nameEn": "Kalika",
    "nameNe": "कालिका"
  },
  {
    "id": 280,
    "districtId": 24,
    "typeId": 3,
    "nameEn": "Khairhani",
    "nameNe": "खैरहनी"
  },
  {
    "id": 281,
    "districtId": 24,
    "typeId": 3,
    "nameEn": "Madi",
    "nameNe": "माडी"
  },
  {
    "id": 282,
    "districtId": 24,
    "typeId": 3,
    "nameEn": "Ratnagar",
    "nameNe": "रत्ननगर"
  },
  {
    "id": 283,
    "districtId": 24,
    "typeId": 3,
    "nameEn": "Rapti",
    "nameNe": "राप्ती"
  },
  {
    "id": 284,
    "districtId": 24,
    "typeId": 4,
    "nameEn": "Ichchhakamana",
    "nameNe": "इच्छाकामना"
  },
  {
    "id": 285,
    "districtId": 25,
    "typeId": 3,
    "nameEn": "Dhunibeshi",
    "nameNe": "धुनीबेंशी"
  },
  {
    "id": 286,
    "districtId": 25,
    "typeId": 3,
    "nameEn": "Nilkantha",
    "nameNe": "निलकण्ठ"
  },
  {
    "id": 287,
    "districtId": 25,
    "typeId": 4,
    "nameEn": "Khaniyabas",
    "nameNe": "खनियाबास"
  },
  {
    "id": 288,
    "districtId": 25,
    "typeId": 4,
    "nameEn": "Gajuri",
    "nameNe": "गजुरी"
  },
  {
    "id": 289,
    "districtId": 25,
    "typeId": 4,
    "nameEn": "Galchhi",
    "nameNe": "गल्छी"
  },
  {
    "id": 290,
    "districtId": 25,
    "typeId": 4,
    "nameEn": "Gangajamuna",
    "nameNe": "गङ्गाजमुना"
  },
  {
    "id": 291,
    "districtId": 25,
    "typeId": 4,
    "nameEn": "Jwalamukhi",
    "nameNe": "ज्वालामूखी"
  },
  {
    "id": 292,
    "districtId": 25,
    "typeId": 4,
    "nameEn": "Thakre",
    "nameNe": "थाक्रे"
  },
  {
    "id": 293,
    "districtId": 25,
    "typeId": 4,
    "nameEn": "Netrawati Dabjong",
    "nameNe": "नेत्रावती डबजोङ"
  },
  {
    "id": 294,
    "districtId": 25,
    "typeId": 4,
    "nameEn": "Benighat Rorang",
    "nameNe": "बेनीघाट रोराङ्ग"
  },
  {
    "id": 295,
    "districtId": 25,
    "typeId": 4,
    "nameEn": "Rubi Valley",
    "nameNe": "रुवी भ्याली"
  },
  {
    "id": 296,
    "districtId": 25,
    "typeId": 4,
    "nameEn": "Siddhalek",
    "nameNe": "सिद्धलेक"
  },
  {
    "id": 297,
    "districtId": 25,
    "typeId": 4,
    "nameEn": "Tripurasundari",
    "nameNe": "त्रिपुरासुन्दरी"
  },
  {
    "id": 298,
    "districtId": 26,
    "typeId": 3,
    "nameEn": "Bhimeswor",
    "nameNe": "भिमेश्वर"
  },
  {
    "id": 299,
    "districtId": 26,
    "typeId": 3,
    "nameEn": "Jiri",
    "nameNe": "जिरी"
  },
  {
    "id": 300,
    "districtId": 26,
    "typeId": 4,
    "nameEn": "Kalinchok",
    "nameNe": "कालिन्चोक"
  },
  {
    "id": 301,
    "districtId": 26,
    "typeId": 4,
    "nameEn": "Melung",
    "nameNe": "मेलुङ्ग"
  },
  {
    "id": 302,
    "districtId": 26,
    "typeId": 4,
    "nameEn": "Bigu",
    "nameNe": "विगु"
  },
  {
    "id": 303,
    "districtId": 26,
    "typeId": 4,
    "nameEn": "Gaurishankar",
    "nameNe": "गौरीशङ्कर"
  },
  {
    "id": 304,
    "districtId": 26,
    "typeId": 4,
    "nameEn": "Baiteshowr",
    "nameNe": "वैतेश्वर"
  },
  {
    "id": 305,
    "districtId": 26,
    "typeId": 4,
    "nameEn": "Sailung",
    "nameNe": "शैलुङ्ग"
  },
  {
    "id": 306,
    "districtId": 26,
    "typeId": 4,
    "nameEn": "Tamakoshi",
    "nameNe": "तामाकोशी"
  },
  {
    "id": 307,
    "districtId": 27,
    "typeId": 1,
    "nameEn": "Kathmandu",
    "nameNe": "काठमाण्डौं"
  },
  {
    "id": 308,
    "districtId": 27,
    "typeId": 3,
    "nameEn": "Gokarneshwar",
    "nameNe": "गोकर्णेश्वर"
  },
  {
    "id": 309,
    "districtId": 27,
    "typeId": 3,
    "nameEn": "Kirtipur",
    "nameNe": "कीर्तिपुर"
  },
  {
    "id": 310,
    "districtId": 27,
    "typeId": 3,
    "nameEn": "Kageshwari-Manohara",
    "nameNe": "कागेश्वरी मनोहरा"
  },
  {
    "id": 311,
    "districtId": 27,
    "typeId": 3,
    "nameEn": "Chandragiri",
    "nameNe": "चन्द्रागिरी"
  },
  {
    "id": 312,
    "districtId": 27,
    "typeId": 3,
    "nameEn": "Tokha",
    "nameNe": "टोखा"
  },
  {
    "id": 313,
    "districtId": 27,
    "typeId": 3,
    "nameEn": "Tarakeshwar",
    "nameNe": "तारकेश्वर"
  },
  {
    "id": 314,
    "districtId": 27,
    "typeId": 3,
    "nameEn": "Dakshinkali",
    "nameNe": "दक्षिणकाली"
  },
  {
    "id": 315,
    "districtId": 27,
    "typeId": 3,
    "nameEn": "Nagarjun",
    "nameNe": "नागार्जुन"
  },
  {
    "id": 316,
    "districtId": 27,
    "typeId": 3,
    "nameEn": "Budhalikantha",
    "nameNe": "बुढानिलकण्ठ"
  },
  {
    "id": 317,
    "districtId": 27,
    "typeId": 3,
    "nameEn": "Shankharapur",
    "nameNe": "शङ्खरापुर"
  },
  {
    "id": 318,
    "districtId": 28,
    "typeId": 3,
    "nameEn": "Dhulikhel",
    "nameNe": "धुलिखेल"
  },
  {
    "id": 319,
    "districtId": 28,
    "typeId": 3,
    "nameEn": "Namobuddha",
    "nameNe": "नमोबुद्ध"
  },
  {
    "id": 320,
    "districtId": 28,
    "typeId": 3,
    "nameEn": "Panauti",
    "nameNe": "पनौती"
  },
  {
    "id": 321,
    "districtId": 28,
    "typeId": 3,
    "nameEn": "Panchkhal",
    "nameNe": "पाँचखाल"
  },
  {
    "id": 322,
    "districtId": 28,
    "typeId": 3,
    "nameEn": "Banepa",
    "nameNe": "बनेपा"
  },
  {
    "id": 323,
    "districtId": 28,
    "typeId": 3,
    "nameEn": "Mandandeupur",
    "nameNe": "मण्डनदेउपुर"
  },
  {
    "id": 324,
    "districtId": 28,
    "typeId": 4,
    "nameEn": "Khani Khola",
    "nameNe": "खानीखोला"
  },
  {
    "id": 325,
    "districtId": 28,
    "typeId": 4,
    "nameEn": "Chauri Deurali",
    "nameNe": "चौंरीदेउराली"
  },
  {
    "id": 326,
    "districtId": 28,
    "typeId": 4,
    "nameEn": "Temal",
    "nameNe": "तेमाल"
  },
  {
    "id": 327,
    "districtId": 28,
    "typeId": 4,
    "nameEn": "Bethanchok",
    "nameNe": "बेथानचोक"
  },
  {
    "id": 328,
    "districtId": 28,
    "typeId": 4,
    "nameEn": "Bhumlu",
    "nameNe": "भुम्लु"
  },
  {
    "id": 329,
    "districtId": 28,
    "typeId": 4,
    "nameEn": "Mahabharat",
    "nameNe": "महाभारत"
  },
  {
    "id": 330,
    "districtId": 28,
    "typeId": 4,
    "nameEn": "Roshi",
    "nameNe": "रोशी"
  },
  {
    "id": 331,
    "districtId": 29,
    "typeId": 1,
    "nameEn": "Lalitpur",
    "nameNe": "ललितपुर"
  },
  {
    "id": 332,
    "districtId": 29,
    "typeId": 3,
    "nameEn": "Mahalaxmi",
    "nameNe": "महालक्ष्मी"
  },
  {
    "id": 333,
    "districtId": 29,
    "typeId": 3,
    "nameEn": "Godawari",
    "nameNe": "गोदावरी"
  },
  {
    "id": 334,
    "districtId": 29,
    "typeId": 4,
    "nameEn": "Konjyosom",
    "nameNe": "कोन्ज्योसोम"
  },
  {
    "id": 335,
    "districtId": 29,
    "typeId": 4,
    "nameEn": "Bagmati",
    "nameNe": "बागमती"
  },
  {
    "id": 336,
    "districtId": 29,
    "typeId": 4,
    "nameEn": "Mahankal",
    "nameNe": "महाङ्काल"
  },
  {
    "id": 337,
    "districtId": 30,
    "typeId": 2,
    "nameEn": "Hetauda",
    "nameNe": "हेटौडा"
  },
  {
    "id": 338,
    "districtId": 30,
    "typeId": 3,
    "nameEn": "Thaha",
    "nameNe": "थाहा"
  },
  {
    "id": 339,
    "districtId": 30,
    "typeId": 4,
    "nameEn": "Bhimphedi",
    "nameNe": "भिमफेदी"
  },
  {
    "id": 340,
    "districtId": 30,
    "typeId": 4,
    "nameEn": "Makawanpurgadhi",
    "nameNe": "मकवानपुरगढी"
  },
  {
    "id": 341,
    "districtId": 30,
    "typeId": 4,
    "nameEn": "Manahari",
    "nameNe": "मनहरी"
  },
  {
    "id": 342,
    "districtId": 30,
    "typeId": 4,
    "nameEn": "Raksirang",
    "nameNe": "राक्सिराङ्ग"
  },
  {
    "id": 343,
    "districtId": 30,
    "typeId": 4,
    "nameEn": "Bakaiya",
    "nameNe": "बकैया"
  },
  {
    "id": 344,
    "districtId": 30,
    "typeId": 4,
    "nameEn": "Bagmati",
    "nameNe": "बाग्मति"
  },
  {
    "id": 345,
    "districtId": 30,
    "typeId": 4,
    "nameEn": "Kailash",
    "nameNe": "कैलाश"
  },
  {
    "id": 346,
    "districtId": 30,
    "typeId": 4,
    "nameEn": "Indrasarowar",
    "nameNe": "इन्द्रसरोबर"
  },
  {
    "id": 347,
    "districtId": 31,
    "typeId": 3,
    "nameEn": "Bidur",
    "nameNe": "विदुर"
  },
  {
    "id": 348,
    "districtId": 31,
    "typeId": 3,
    "nameEn": "Belkotgadhi",
    "nameNe": "बेलकोटगढी"
  },
  {
    "id": 349,
    "districtId": 31,
    "typeId": 4,
    "nameEn": "Kakani",
    "nameNe": "ककनी"
  },
  {
    "id": 350,
    "districtId": 31,
    "typeId": 4,
    "nameEn": "Panchakanya",
    "nameNe": "पञ्चकन्या"
  },
  {
    "id": 351,
    "districtId": 31,
    "typeId": 4,
    "nameEn": "Likhu",
    "nameNe": "लिखु"
  },
  {
    "id": 352,
    "districtId": 31,
    "typeId": 4,
    "nameEn": "Dupcheshwar",
    "nameNe": "दुप्चेश्वर"
  },
  {
    "id": 353,
    "districtId": 31,
    "typeId": 4,
    "nameEn": "Shivapuri",
    "nameNe": "शिवपुरी"
  },
  {
    "id": 354,
    "districtId": 31,
    "typeId": 4,
    "nameEn": "Tadi",
    "nameNe": "तादी"
  },
  {
    "id": 355,
    "districtId": 31,
    "typeId": 4,
    "nameEn": "Suryagadhi",
    "nameNe": "सुर्यगढी"
  },
  {
    "id": 356,
    "districtId": 31,
    "typeId": 4,
    "nameEn": "Tarkeshwar",
    "nameNe": "तारकेश्वर"
  },
  {
    "id": 357,
    "districtId": 31,
    "typeId": 4,
    "nameEn": "Kispang",
    "nameNe": "किस्पाङ"
  },
  {
    "id": 358,
    "districtId": 31,
    "typeId": 4,
    "nameEn": "Myagang",
    "nameNe": "म्यगङ"
  },
  {
    "id": 359,
    "districtId": 32,
    "typeId": 3,
    "nameEn": "Manthali",
    "nameNe": "मन्थली"
  },
  {
    "id": 360,
    "districtId": 32,
    "typeId": 3,
    "nameEn": "Ramechhap",
    "nameNe": "रामेछाप"
  },
  {
    "id": 361,
    "districtId": 32,
    "typeId": 4,
    "nameEn": "Umakunda",
    "nameNe": "उमाकुण्ड"
  },
  {
    "id": 362,
    "districtId": 32,
    "typeId": 4,
    "nameEn": "Khandadevi",
    "nameNe": "खाँडादेवी"
  },
  {
    "id": 363,
    "districtId": 32,
    "typeId": 4,
    "nameEn": "Doramba",
    "nameNe": "दोरम्बा"
  },
  {
    "id": 364,
    "districtId": 32,
    "typeId": 4,
    "nameEn": "Gokulganga",
    "nameNe": "गोकुलगङ्गा"
  },
  {
    "id": 365,
    "districtId": 32,
    "typeId": 4,
    "nameEn": "LikhuTamakoshi",
    "nameNe": "लिखु तामाकोशी"
  },
  {
    "id": 366,
    "districtId": 32,
    "typeId": 4,
    "nameEn": "Sunapati",
    "nameNe": "सुनापती"
  },
  {
    "id": 367,
    "districtId": 33,
    "typeId": 4,
    "nameEn": "Kalika",
    "nameNe": "कालिका"
  },
  {
    "id": 368,
    "districtId": 33,
    "typeId": 4,
    "nameEn": "Gosaikunda",
    "nameNe": "गोसाईकुण्ड"
  },
  {
    "id": 369,
    "districtId": 33,
    "typeId": 4,
    "nameEn": "Naukunda",
    "nameNe": "नौकुण्ड"
  },
  {
    "id": 370,
    "districtId": 33,
    "typeId": 4,
    "nameEn": "Parbatikunda",
    "nameNe": "आमाछोदिङमो"
  },
  {
    "id": 371,
    "districtId": 33,
    "typeId": 4,
    "nameEn": "Uttargaya",
    "nameNe": "उत्तरगया"
  },
  {
    "id": 372,
    "districtId": 34,
    "typeId": 3,
    "nameEn": "Kamalamai",
    "nameNe": "कमलामाई"
  },
  {
    "id": 373,
    "districtId": 34,
    "typeId": 3,
    "nameEn": "Dudhauli",
    "nameNe": "दुधौली"
  },
  {
    "id": 374,
    "districtId": 34,
    "typeId": 4,
    "nameEn": "Sunkoshi",
    "nameNe": "सुनकोशी"
  },
  {
    "id": 375,
    "districtId": 34,
    "typeId": 4,
    "nameEn": "Hariharpurgadhi",
    "nameNe": "हरिहरपुरगढी"
  },
  {
    "id": 376,
    "districtId": 34,
    "typeId": 4,
    "nameEn": "Tinpatan",
    "nameNe": "तीनपाटन"
  },
  {
    "id": 377,
    "districtId": 34,
    "typeId": 4,
    "nameEn": "Marin",
    "nameNe": "मरिण"
  },
  {
    "id": 378,
    "districtId": 34,
    "typeId": 4,
    "nameEn": "Golanjor",
    "nameNe": "गोलन्जर"
  },
  {
    "id": 379,
    "districtId": 34,
    "typeId": 4,
    "nameEn": "Phikkal",
    "nameNe": "फिक्कल"
  },
  {
    "id": 380,
    "districtId": 34,
    "typeId": 4,
    "nameEn": "Ghyanglekh",
    "nameNe": "घ्याङलेख"
  },
  {
    "id": 381,
    "districtId": 35,
    "typeId": 3,
    "nameEn": "Chautara Sangachowkgadi",
    "nameNe": "चौतारा साँगाचोकगढी"
  },
  {
    "id": 382,
    "districtId": 35,
    "typeId": 3,
    "nameEn": "Bahrabise",
    "nameNe": "बाह्रविसे"
  },
  {
    "id": 383,
    "districtId": 35,
    "typeId": 3,
    "nameEn": "Melamchi",
    "nameNe": "मेलम्ची"
  },
  {
    "id": 384,
    "districtId": 35,
    "typeId": 4,
    "nameEn": "Balephi",
    "nameNe": "बलेफी"
  },
  {
    "id": 385,
    "districtId": 35,
    "typeId": 4,
    "nameEn": "Sunkoshi",
    "nameNe": "सुनकोशी"
  },
  {
    "id": 386,
    "districtId": 35,
    "typeId": 4,
    "nameEn": "Indrawati",
    "nameNe": "ईन्द्रावती"
  },
  {
    "id": 387,
    "districtId": 35,
    "typeId": 4,
    "nameEn": "Jugal",
    "nameNe": "जुगल"
  },
  {
    "id": 388,
    "districtId": 35,
    "typeId": 4,
    "nameEn": "Panchpokhari",
    "nameNe": "पाँचपोखरी थाङपाल"
  },
  {
    "id": 389,
    "districtId": 35,
    "typeId": 4,
    "nameEn": "Bhotekoshi",
    "nameNe": "भोटेकोशी"
  },
  {
    "id": 390,
    "districtId": 35,
    "typeId": 4,
    "nameEn": "Lisankhu",
    "nameNe": "लिसङ्खु पाखर"
  },
  {
    "id": 391,
    "districtId": 35,
    "typeId": 4,
    "nameEn": "Helambu",
    "nameNe": "हेलम्बु"
  },
  {
    "id": 392,
    "districtId": 35,
    "typeId": 4,
    "nameEn": "Tripurasundari",
    "nameNe": "त्रिपुरासुन्दरी"
  },
  {
    "id": 393,
    "districtId": 36,
    "typeId": 3,
    "nameEn": "Baglung",
    "nameNe": "बागलुङ"
  },
  {
    "id": 394,
    "districtId": 36,
    "typeId": 3,
    "nameEn": "Dhorpatan",
    "nameNe": "ढोरपाटन"
  },
  {
    "id": 395,
    "districtId": 36,
    "typeId": 3,
    "nameEn": "Galkot",
    "nameNe": "गल्कोट"
  },
  {
    "id": 396,
    "districtId": 36,
    "typeId": 3,
    "nameEn": "Jaimuni",
    "nameNe": "जैमूनी"
  },
  {
    "id": 397,
    "districtId": 36,
    "typeId": 4,
    "nameEn": "Bareng",
    "nameNe": "वरेङ"
  },
  {
    "id": 398,
    "districtId": 36,
    "typeId": 4,
    "nameEn": "Khathekhola",
    "nameNe": "काठेखोला"
  },
  {
    "id": 399,
    "districtId": 36,
    "typeId": 4,
    "nameEn": "Taman Khola",
    "nameNe": "तमानखोला"
  },
  {
    "id": 400,
    "districtId": 36,
    "typeId": 4,
    "nameEn": "Tara Khola",
    "nameNe": "ताराखोला"
  },
  {
    "id": 401,
    "districtId": 36,
    "typeId": 4,
    "nameEn": "Nishi Khola",
    "nameNe": "निसीखोला"
  },
  {
    "id": 402,
    "districtId": 36,
    "typeId": 4,
    "nameEn": "Badigad",
    "nameNe": "वडिगाड"
  },
  {
    "id": 403,
    "districtId": 37,
    "typeId": 3,
    "nameEn": "Gorkha",
    "nameNe": "गोरखा"
  },
  {
    "id": 404,
    "districtId": 37,
    "typeId": 3,
    "nameEn": "Palungtar",
    "nameNe": "पालुङटार"
  },
  {
    "id": 405,
    "districtId": 37,
    "typeId": 4,
    "nameEn": "Sulikot",
    "nameNe": "बारपाक सुलिकोट"
  },
  {
    "id": 406,
    "districtId": 37,
    "typeId": 4,
    "nameEn": "Siranchowk",
    "nameNe": "सिरानचोक"
  },
  {
    "id": 407,
    "districtId": 37,
    "typeId": 4,
    "nameEn": "Ajirkot",
    "nameNe": "अजिरकोट"
  },
  {
    "id": 408,
    "districtId": 37,
    "typeId": 4,
    "nameEn": "Chumnubri",
    "nameNe": "चुमनुव्री"
  },
  {
    "id": 409,
    "districtId": 37,
    "typeId": 4,
    "nameEn": "Dharche",
    "nameNe": "धार्चे"
  },
  {
    "id": 410,
    "districtId": 37,
    "typeId": 4,
    "nameEn": "Bhimsen Thapa",
    "nameNe": "भिमसेनथापा"
  },
  {
    "id": 411,
    "districtId": 37,
    "typeId": 4,
    "nameEn": "Sahid Lakhan",
    "nameNe": "शहिद लखन"
  },
  {
    "id": 412,
    "districtId": 37,
    "typeId": 4,
    "nameEn": "Aarughat",
    "nameNe": "आरूघाट"
  },
  {
    "id": 413,
    "districtId": 37,
    "typeId": 4,
    "nameEn": "Gandaki",
    "nameNe": "गण्डकी"
  },
  {
    "id": 414,
    "districtId": 38,
    "typeId": 1,
    "nameEn": "Pokhara",
    "nameNe": "पोखरा"
  },
  {
    "id": 415,
    "districtId": 38,
    "typeId": 4,
    "nameEn": "Annapurna",
    "nameNe": "अन्नपूर्ण"
  },
  {
    "id": 416,
    "districtId": 38,
    "typeId": 4,
    "nameEn": "Machhapuchchhre",
    "nameNe": "माछापुच्छ्रे"
  },
  {
    "id": 417,
    "districtId": 38,
    "typeId": 4,
    "nameEn": "Madi",
    "nameNe": "मादी"
  },
  {
    "id": 418,
    "districtId": 38,
    "typeId": 4,
    "nameEn": "Rupa",
    "nameNe": "रूपा"
  },
  {
    "id": 419,
    "districtId": 39,
    "typeId": 3,
    "nameEn": "Besisahar",
    "nameNe": "बेसीशहर"
  },
  {
    "id": 420,
    "districtId": 39,
    "typeId": 3,
    "nameEn": "Madhya Nepal",
    "nameNe": "मध्यनेपाल"
  },
  {
    "id": 421,
    "districtId": 39,
    "typeId": 3,
    "nameEn": "Rainas",
    "nameNe": "रारइनास"
  },
  {
    "id": 422,
    "districtId": 39,
    "typeId": 3,
    "nameEn": "Sundarbazar",
    "nameNe": "सुन्दरबजार"
  },
  {
    "id": 423,
    "districtId": 39,
    "typeId": 4,
    "nameEn": "Dordi",
    "nameNe": "दोर्दी"
  },
  {
    "id": 424,
    "districtId": 39,
    "typeId": 4,
    "nameEn": "Dudhpokhari",
    "nameNe": "दूधपोखरी"
  },
  {
    "id": 425,
    "districtId": 39,
    "typeId": 4,
    "nameEn": "Kwhlosothar",
    "nameNe": "क्व्होलासोथार"
  },
  {
    "id": 426,
    "districtId": 39,
    "typeId": 4,
    "nameEn": "Marsyangdi",
    "nameNe": "मर्स्याङदी"
  },
  {
    "id": 427,
    "districtId": 40,
    "typeId": 4,
    "nameEn": "Chame",
    "nameNe": "चामे"
  },
  {
    "id": 428,
    "districtId": 40,
    "typeId": 4,
    "nameEn": "Nason",
    "nameNe": "नासोँ"
  },
  {
    "id": 429,
    "districtId": 40,
    "typeId": 4,
    "nameEn": "NarpaBhumi",
    "nameNe": "नार्पा भूमि"
  },
  {
    "id": 430,
    "districtId": 40,
    "typeId": 4,
    "nameEn": "Manang Ngisyang",
    "nameNe": "मनाङ ङिस्याङ"
  },
  {
    "id": 431,
    "districtId": 41,
    "typeId": 4,
    "nameEn": "Gharpajhong",
    "nameNe": "घरपझोङ"
  },
  {
    "id": 432,
    "districtId": 41,
    "typeId": 4,
    "nameEn": "Thasang",
    "nameNe": "थासाङ"
  },
  {
    "id": 433,
    "districtId": 41,
    "typeId": 4,
    "nameEn": "Barhagaun Muktichhetra",
    "nameNe": "वारागुङ मुक्तिक्षेत्र"
  },
  {
    "id": 434,
    "districtId": 41,
    "typeId": 4,
    "nameEn": "Lomanthang",
    "nameNe": "लोमन्थाङ"
  },
  {
    "id": 435,
    "districtId": 41,
    "typeId": 4,
    "nameEn": "Lo-Ghekar Damodarkunda",
    "nameNe": "लो-घेकर दामोदरकुण्ड"
  },
  {
    "id": 436,
    "districtId": 42,
    "typeId": 3,
    "nameEn": "Beni",
    "nameNe": "बेनी"
  },
  {
    "id": 437,
    "districtId": 42,
    "typeId": 4,
    "nameEn": "Annapurna",
    "nameNe": "अन्नपुर्ण"
  },
  {
    "id": 438,
    "districtId": 42,
    "typeId": 4,
    "nameEn": "Dhaulagiri",
    "nameNe": "धवलागिरी"
  },
  {
    "id": 439,
    "districtId": 42,
    "typeId": 4,
    "nameEn": "Mangala",
    "nameNe": "मंगला"
  },
  {
    "id": 440,
    "districtId": 42,
    "typeId": 4,
    "nameEn": "Malika",
    "nameNe": "मालिका"
  },
  {
    "id": 441,
    "districtId": 42,
    "typeId": 4,
    "nameEn": "Raghuganga",
    "nameNe": "रघुगंगा"
  },
  {
    "id": 442,
    "districtId": 43,
    "typeId": 3,
    "nameEn": "Kawasoti",
    "nameNe": "कावासोती"
  },
  {
    "id": 443,
    "districtId": 43,
    "typeId": 3,
    "nameEn": "Gaindakot",
    "nameNe": "गैडाकोट"
  },
  {
    "id": 444,
    "districtId": 43,
    "typeId": 3,
    "nameEn": "Devachuli",
    "nameNe": "देवचुली"
  },
  {
    "id": 445,
    "districtId": 43,
    "typeId": 3,
    "nameEn": "Madhya Bindu",
    "nameNe": "मध्यविन्दु"
  },
  {
    "id": 446,
    "districtId": 43,
    "typeId": 4,
    "nameEn": "Baudikali",
    "nameNe": "बौदीकाली"
  },
  {
    "id": 447,
    "districtId": 43,
    "typeId": 4,
    "nameEn": "Bulingtar",
    "nameNe": "बुलिङटार"
  },
  {
    "id": 448,
    "districtId": 43,
    "typeId": 4,
    "nameEn": "Binayi Tribeni",
    "nameNe": "विनयी त्रिवेणी"
  },
  {
    "id": 449,
    "districtId": 43,
    "typeId": 4,
    "nameEn": "Hupsekot",
    "nameNe": "हुप्सेकोट"
  },
  {
    "id": 450,
    "districtId": 44,
    "typeId": 3,
    "nameEn": "Kushma",
    "nameNe": "कुश्मा"
  },
  {
    "id": 451,
    "districtId": 44,
    "typeId": 3,
    "nameEn": "Phalewas",
    "nameNe": "फलेवास"
  },
  {
    "id": 452,
    "districtId": 44,
    "typeId": 4,
    "nameEn": "Jaljala",
    "nameNe": "जलजला"
  },
  {
    "id": 453,
    "districtId": 44,
    "typeId": 4,
    "nameEn": "Paiyun",
    "nameNe": "पैयूं"
  },
  {
    "id": 454,
    "districtId": 44,
    "typeId": 4,
    "nameEn": "Mahashila",
    "nameNe": "महाशिला"
  },
  {
    "id": 455,
    "districtId": 44,
    "typeId": 4,
    "nameEn": "Modi",
    "nameNe": "मोदी"
  },
  {
    "id": 456,
    "districtId": 44,
    "typeId": 4,
    "nameEn": "Bihadi",
    "nameNe": "विहादी"
  },
  {
    "id": 457,
    "districtId": 45,
    "typeId": 3,
    "nameEn": "Galyang",
    "nameNe": "गल्याङ"
  },
  {
    "id": 458,
    "districtId": 45,
    "typeId": 3,
    "nameEn": "Chapakot",
    "nameNe": "चापाकोट"
  },
  {
    "id": 459,
    "districtId": 45,
    "typeId": 3,
    "nameEn": "Putalibazar",
    "nameNe": "पुतलीबजार"
  },
  {
    "id": 460,
    "districtId": 45,
    "typeId": 3,
    "nameEn": "Bheerkot",
    "nameNe": "भीरकोट"
  },
  {
    "id": 461,
    "districtId": 45,
    "typeId": 3,
    "nameEn": "Waling",
    "nameNe": "वालिङ"
  },
  {
    "id": 462,
    "districtId": 45,
    "typeId": 4,
    "nameEn": "Arjun Chaupari",
    "nameNe": "अर्जुनचौपारी"
  },
  {
    "id": 463,
    "districtId": 45,
    "typeId": 4,
    "nameEn": "Aandhikhola",
    "nameNe": "आँधिखोला"
  },
  {
    "id": 464,
    "districtId": 45,
    "typeId": 4,
    "nameEn": "Kaligandaki",
    "nameNe": "कालीगण्डकी"
  },
  {
    "id": 465,
    "districtId": 45,
    "typeId": 4,
    "nameEn": "Phedikhola",
    "nameNe": "फेदीखोला"
  },
  {
    "id": 466,
    "districtId": 45,
    "typeId": 4,
    "nameEn": "Harinas",
    "nameNe": "हरिनास"
  },
  {
    "id": 467,
    "districtId": 45,
    "typeId": 4,
    "nameEn": "Biruwa",
    "nameNe": "बिरुवा"
  },
  {
    "id": 468,
    "districtId": 46,
    "typeId": 3,
    "nameEn": "Bhanu",
    "nameNe": "भानु"
  },
  {
    "id": 469,
    "districtId": 46,
    "typeId": 3,
    "nameEn": "Bhimad",
    "nameNe": "भिमाद"
  },
  {
    "id": 470,
    "districtId": 46,
    "typeId": 3,
    "nameEn": "Byas",
    "nameNe": "व्यास"
  },
  {
    "id": 471,
    "districtId": 46,
    "typeId": 3,
    "nameEn": "Suklagandaki",
    "nameNe": "शुक्लागण्डकी"
  },
  {
    "id": 472,
    "districtId": 46,
    "typeId": 4,
    "nameEn": "AnbuKhaireni",
    "nameNe": "आँबुखैरेनी"
  },
  {
    "id": 473,
    "districtId": 46,
    "typeId": 4,
    "nameEn": "Devghat",
    "nameNe": "देवघाट"
  },
  {
    "id": 474,
    "districtId": 46,
    "typeId": 4,
    "nameEn": "Bandipur",
    "nameNe": "वन्दिपुर"
  },
  {
    "id": 475,
    "districtId": 46,
    "typeId": 4,
    "nameEn": "Rishing",
    "nameNe": "ऋषिङ्ग"
  },
  {
    "id": 476,
    "districtId": 46,
    "typeId": 4,
    "nameEn": "Ghiring",
    "nameNe": "घिरिङ"
  },
  {
    "id": 477,
    "districtId": 46,
    "typeId": 4,
    "nameEn": "Myagde",
    "nameNe": "म्याग्दे"
  },
  {
    "id": 478,
    "districtId": 47,
    "typeId": 3,
    "nameEn": "Kapilvastu",
    "nameNe": "कपिलवस्तु"
  },
  {
    "id": 479,
    "districtId": 47,
    "typeId": 3,
    "nameEn": "Banganga",
    "nameNe": "बाणगंगा"
  },
  {
    "id": 480,
    "districtId": 47,
    "typeId": 3,
    "nameEn": "Buddhabhumi",
    "nameNe": "बुद्धभुमी"
  },
  {
    "id": 481,
    "districtId": 47,
    "typeId": 3,
    "nameEn": "Shivaraj",
    "nameNe": "शिवराज"
  },
  {
    "id": 482,
    "districtId": 47,
    "typeId": 3,
    "nameEn": "Krishnanagar",
    "nameNe": "कृष्णनगर"
  },
  {
    "id": 483,
    "districtId": 47,
    "typeId": 3,
    "nameEn": "Maharajgunj",
    "nameNe": "महाराजगंज"
  },
  {
    "id": 484,
    "districtId": 47,
    "typeId": 4,
    "nameEn": "Mayadevi",
    "nameNe": "मायादेवी"
  },
  {
    "id": 485,
    "districtId": 47,
    "typeId": 4,
    "nameEn": "Yashodhara",
    "nameNe": "यसोधरा"
  },
  {
    "id": 486,
    "districtId": 47,
    "typeId": 4,
    "nameEn": "Suddhodan",
    "nameNe": "सुद्धोधन"
  },
  {
    "id": 487,
    "districtId": 47,
    "typeId": 4,
    "nameEn": "Bijaynagar",
    "nameNe": "विजयनगर"
  },
  {
    "id": 488,
    "districtId": 48,
    "typeId": 3,
    "nameEn": "Bardaghat",
    "nameNe": "बर्दघाट"
  },
  {
    "id": 489,
    "districtId": 48,
    "typeId": 3,
    "nameEn": "Ramgram",
    "nameNe": "रामग्राम"
  },
  {
    "id": 490,
    "districtId": 48,
    "typeId": 3,
    "nameEn": "Sunwal",
    "nameNe": "सुनवल"
  },
  {
    "id": 491,
    "districtId": 48,
    "typeId": 4,
    "nameEn": "Susta",
    "nameNe": "सुस्ता"
  },
  {
    "id": 492,
    "districtId": 48,
    "typeId": 4,
    "nameEn": "Palhi Nandan",
    "nameNe": "पाल्हीनन्दन"
  },
  {
    "id": 493,
    "districtId": 48,
    "typeId": 4,
    "nameEn": "Pratappur",
    "nameNe": "प्रतापपुर"
  },
  {
    "id": 494,
    "districtId": 48,
    "typeId": 4,
    "nameEn": "Sarawal",
    "nameNe": "सरावल"
  },
  {
    "id": 495,
    "districtId": 49,
    "typeId": 2,
    "nameEn": "Butwal",
    "nameNe": "बुटवल"
  },
  {
    "id": 496,
    "districtId": 49,
    "typeId": 3,
    "nameEn": "Devdaha",
    "nameNe": "देवदह"
  },
  {
    "id": 497,
    "districtId": 49,
    "typeId": 3,
    "nameEn": "Lumbini Sanskritik",
    "nameNe": "लुम्बिनी सांस्कृतिक"
  },
  {
    "id": 498,
    "districtId": 49,
    "typeId": 3,
    "nameEn": "Sainamaina",
    "nameNe": "सैनामैना"
  },
  {
    "id": 499,
    "districtId": 49,
    "typeId": 3,
    "nameEn": "Siddharthanagar",
    "nameNe": "सिद्धार्थनगर"
  },
  {
    "id": 500,
    "districtId": 49,
    "typeId": 3,
    "nameEn": "Tilottama",
    "nameNe": "तिलोत्तमा"
  },
  {
    "id": 501,
    "districtId": 49,
    "typeId": 4,
    "nameEn": "Gaidahawa",
    "nameNe": "गैडहवा"
  },
  {
    "id": 502,
    "districtId": 49,
    "typeId": 4,
    "nameEn": "Kanchan",
    "nameNe": "कन्चन"
  },
  {
    "id": 503,
    "districtId": 49,
    "typeId": 4,
    "nameEn": "Kotahimai",
    "nameNe": "कोटहीमाई"
  },
  {
    "id": 504,
    "districtId": 49,
    "typeId": 4,
    "nameEn": "Marchawari",
    "nameNe": "मर्चवारी"
  },
  {
    "id": 505,
    "districtId": 49,
    "typeId": 4,
    "nameEn": "Mayadevi",
    "nameNe": "मायादेवी"
  },
  {
    "id": 506,
    "districtId": 49,
    "typeId": 4,
    "nameEn": "Omsatiya",
    "nameNe": "ओमसतिया"
  },
  {
    "id": 507,
    "districtId": 49,
    "typeId": 4,
    "nameEn": "Rohini",
    "nameNe": "रोहिणी"
  },
  {
    "id": 508,
    "districtId": 49,
    "typeId": 4,
    "nameEn": "Sammarimai",
    "nameNe": "सम्मरीमाई"
  },
  {
    "id": 509,
    "districtId": 49,
    "typeId": 4,
    "nameEn": "Siyari",
    "nameNe": "सियारी"
  },
  {
    "id": 510,
    "districtId": 49,
    "typeId": 4,
    "nameEn": "Suddodhan",
    "nameNe": "शुद्धोधन"
  },
  {
    "id": 511,
    "districtId": 50,
    "typeId": 3,
    "nameEn": "Sandhikharka",
    "nameNe": "सन्धिखर्क"
  },
  {
    "id": 512,
    "districtId": 50,
    "typeId": 3,
    "nameEn": "Sitganga",
    "nameNe": "शितगंगा"
  },
  {
    "id": 513,
    "districtId": 50,
    "typeId": 3,
    "nameEn": "Bhumikasthan",
    "nameNe": "भूमिकास्थान"
  },
  {
    "id": 514,
    "districtId": 50,
    "typeId": 4,
    "nameEn": "Chhatradev",
    "nameNe": "छत्रदेव"
  },
  {
    "id": 515,
    "districtId": 50,
    "typeId": 4,
    "nameEn": "Panini",
    "nameNe": "पाणिनी"
  },
  {
    "id": 516,
    "districtId": 50,
    "typeId": 4,
    "nameEn": "Malarani",
    "nameNe": "मालारानी"
  },
  {
    "id": 517,
    "districtId": 51,
    "typeId": 3,
    "nameEn": "Resunga",
    "nameNe": "रेसुङ्गा"
  },
  {
    "id": 518,
    "districtId": 51,
    "typeId": 3,
    "nameEn": "Musikot",
    "nameNe": "मुसिकोट"
  },
  {
    "id": 519,
    "districtId": 51,
    "typeId": 4,
    "nameEn": "Rurukshetra",
    "nameNe": "रुरुक्षेत्र"
  },
  {
    "id": 520,
    "districtId": 51,
    "typeId": 4,
    "nameEn": "Chhatrakot",
    "nameNe": "छत्रकोट"
  },
  {
    "id": 521,
    "districtId": 51,
    "typeId": 4,
    "nameEn": "Gulmidarbar",
    "nameNe": "गुल्मी दरबार"
  },
  {
    "id": 522,
    "districtId": 51,
    "typeId": 4,
    "nameEn": "Chandrakot",
    "nameNe": "चन्द्रकोट"
  },
  {
    "id": 523,
    "districtId": 51,
    "typeId": 4,
    "nameEn": "Satyawati",
    "nameNe": "सत्यवती"
  },
  {
    "id": 524,
    "districtId": 51,
    "typeId": 4,
    "nameEn": "Dhurkot",
    "nameNe": "धुर्कोट"
  },
  {
    "id": 525,
    "districtId": 51,
    "typeId": 4,
    "nameEn": "Kaligandaki",
    "nameNe": "कालीगण्डकी"
  },
  {
    "id": 526,
    "districtId": 51,
    "typeId": 4,
    "nameEn": "Isma",
    "nameNe": "ईस्मा"
  },
  {
    "id": 527,
    "districtId": 51,
    "typeId": 4,
    "nameEn": "Malika",
    "nameNe": "मालिका"
  },
  {
    "id": 528,
    "districtId": 51,
    "typeId": 4,
    "nameEn": "Madane",
    "nameNe": "मदाने"
  },
  {
    "id": 529,
    "districtId": 52,
    "typeId": 3,
    "nameEn": "Tansen",
    "nameNe": "तानसेन"
  },
  {
    "id": 530,
    "districtId": 52,
    "typeId": 3,
    "nameEn": "Rampur",
    "nameNe": "रामपुर"
  },
  {
    "id": 531,
    "districtId": 52,
    "typeId": 4,
    "nameEn": "Rainadevi Chhahara",
    "nameNe": "रैनादेवी छहरा"
  },
  {
    "id": 532,
    "districtId": 52,
    "typeId": 4,
    "nameEn": "Ripdikot",
    "nameNe": "रिब्दिकोट"
  },
  {
    "id": 533,
    "districtId": 52,
    "typeId": 4,
    "nameEn": "Bagnaskali",
    "nameNe": "बगनासकाली"
  },
  {
    "id": 534,
    "districtId": 52,
    "typeId": 4,
    "nameEn": "Rambha",
    "nameNe": "रम्भा"
  },
  {
    "id": 535,
    "districtId": 52,
    "typeId": 4,
    "nameEn": "Purbakhola",
    "nameNe": "पूर्वखोला"
  },
  {
    "id": 536,
    "districtId": 52,
    "typeId": 4,
    "nameEn": "Nisdi",
    "nameNe": "निस्दी"
  },
  {
    "id": 537,
    "districtId": 52,
    "typeId": 4,
    "nameEn": "Mathagadhi",
    "nameNe": "माथागढी"
  },
  {
    "id": 538,
    "districtId": 52,
    "typeId": 4,
    "nameEn": "Tinahu",
    "nameNe": "तिनाउ"
  },
  {
    "id": 539,
    "districtId": 53,
    "typeId": 2,
    "nameEn": "Ghorahi",
    "nameNe": "घोराही"
  },
  {
    "id": 540,
    "districtId": 53,
    "typeId": 2,
    "nameEn": "Tulsipur",
    "nameNe": "तुल्सीपुर"
  },
  {
    "id": 541,
    "districtId": 53,
    "typeId": 3,
    "nameEn": "Lamahi",
    "nameNe": "लमही"
  },
  {
    "id": 542,
    "districtId": 53,
    "typeId": 4,
    "nameEn": "Gadhawa",
    "nameNe": "गढवा"
  },
  {
    "id": 543,
    "districtId": 53,
    "typeId": 4,
    "nameEn": "Rajpur",
    "nameNe": "राजपुर"
  },
  {
    "id": 544,
    "districtId": 53,
    "typeId": 4,
    "nameEn": "Shantinagar",
    "nameNe": "शान्तिनगर"
  },
  {
    "id": 545,
    "districtId": 53,
    "typeId": 4,
    "nameEn": "Rapti",
    "nameNe": "राप्ती"
  },
  {
    "id": 546,
    "districtId": 53,
    "typeId": 4,
    "nameEn": "Banglachuli",
    "nameNe": "बंगलाचुली"
  },
  {
    "id": 547,
    "districtId": 53,
    "typeId": 4,
    "nameEn": "Dangisharan",
    "nameNe": "दंगीशरण"
  },
  {
    "id": 548,
    "districtId": 53,
    "typeId": 4,
    "nameEn": "Babai",
    "nameNe": "बबई"
  },
  {
    "id": 549,
    "districtId": 54,
    "typeId": 3,
    "nameEn": "Sworgadwari",
    "nameNe": "स्वर्गद्वारी"
  },
  {
    "id": 550,
    "districtId": 54,
    "typeId": 3,
    "nameEn": "Pyuthan",
    "nameNe": "प्यूठान"
  },
  {
    "id": 551,
    "districtId": 54,
    "typeId": 4,
    "nameEn": "Mandavi",
    "nameNe": "माण्डवी"
  },
  {
    "id": 552,
    "districtId": 54,
    "typeId": 4,
    "nameEn": "Sarumarani",
    "nameNe": "सरुमारानी"
  },
  {
    "id": 553,
    "districtId": 54,
    "typeId": 4,
    "nameEn": "Ayirawati",
    "nameNe": "ऐरावती"
  },
  {
    "id": 554,
    "districtId": 54,
    "typeId": 4,
    "nameEn": "Mallarani",
    "nameNe": "मल्लरानी"
  },
  {
    "id": 555,
    "districtId": 54,
    "typeId": 4,
    "nameEn": "Jhimruk",
    "nameNe": "झिमरुक"
  },
  {
    "id": 556,
    "districtId": 54,
    "typeId": 4,
    "nameEn": "Naubahini",
    "nameNe": "नौवहिनी"
  },
  {
    "id": 557,
    "districtId": 54,
    "typeId": 4,
    "nameEn": "Gaumukhi",
    "nameNe": "गौमुखी"
  },
  {
    "id": 558,
    "districtId": 55,
    "typeId": 3,
    "nameEn": "Rolpa",
    "nameNe": "रोल्पा"
  },
  {
    "id": 559,
    "districtId": 55,
    "typeId": 4,
    "nameEn": "Runtigadi",
    "nameNe": "रुन्टीगढी"
  },
  {
    "id": 560,
    "districtId": 55,
    "typeId": 4,
    "nameEn": "Triveni",
    "nameNe": "त्रिवेणी"
  },
  {
    "id": 561,
    "districtId": 55,
    "typeId": 4,
    "nameEn": "Sunil Smiriti",
    "nameNe": "सुनिल स्मृति"
  },
  {
    "id": 562,
    "districtId": 55,
    "typeId": 4,
    "nameEn": "Lungri",
    "nameNe": "लुङग्री"
  },
  {
    "id": 563,
    "districtId": 55,
    "typeId": 4,
    "nameEn": "Sunchhahari",
    "nameNe": "सुनछहरी"
  },
  {
    "id": 564,
    "districtId": 55,
    "typeId": 4,
    "nameEn": "Thawang",
    "nameNe": "थवाङ"
  },
  {
    "id": 565,
    "districtId": 55,
    "typeId": 4,
    "nameEn": "Madi",
    "nameNe": "माडी"
  },
  {
    "id": 566,
    "districtId": 55,
    "typeId": 4,
    "nameEn": "GangaDev",
    "nameNe": "गंगादेव"
  },
  {
    "id": 567,
    "districtId": 55,
    "typeId": 4,
    "nameEn": "Pariwartan",
    "nameNe": "परिवर्तन"
  },
  {
    "id": 568,
    "districtId": 56,
    "typeId": 4,
    "nameEn": "Putha Uttarganga",
    "nameNe": "पुथा उत्तरगंगा"
  },
  {
    "id": 569,
    "districtId": 56,
    "typeId": 4,
    "nameEn": "Bhume",
    "nameNe": "भूमे"
  },
  {
    "id": 570,
    "districtId": 56,
    "typeId": 4,
    "nameEn": "Sisne",
    "nameNe": "सिस्ने"
  },
  {
    "id": 571,
    "districtId": 57,
    "typeId": 2,
    "nameEn": "Nepalgunj",
    "nameNe": "नेपालगंज"
  },
  {
    "id": 572,
    "districtId": 57,
    "typeId": 3,
    "nameEn": "Kohalpur",
    "nameNe": "कोहलपुर"
  },
  {
    "id": 573,
    "districtId": 57,
    "typeId": 4,
    "nameEn": "Rapti-Sonari",
    "nameNe": "राप्ती सोनारी"
  },
  {
    "id": 574,
    "districtId": 57,
    "typeId": 4,
    "nameEn": "Narainapur",
    "nameNe": "नरैनापुर"
  },
  {
    "id": 575,
    "districtId": 57,
    "typeId": 4,
    "nameEn": "Duduwa",
    "nameNe": "डुडुवा"
  },
  {
    "id": 576,
    "districtId": 57,
    "typeId": 4,
    "nameEn": "Janaki",
    "nameNe": "जानकी"
  },
  {
    "id": 577,
    "districtId": 57,
    "typeId": 4,
    "nameEn": "Khajura",
    "nameNe": "खजुरा"
  },
  {
    "id": 578,
    "districtId": 57,
    "typeId": 4,
    "nameEn": "Baijanath",
    "nameNe": "बैजनाथ"
  },
  {
    "id": 579,
    "districtId": 58,
    "typeId": 3,
    "nameEn": "Gulariya",
    "nameNe": "गुलरिया"
  },
  {
    "id": 580,
    "districtId": 58,
    "typeId": 3,
    "nameEn": "Rajapur",
    "nameNe": "राजापुर"
  },
  {
    "id": 581,
    "districtId": 58,
    "typeId": 3,
    "nameEn": "Madhuwan",
    "nameNe": "मधुवन"
  },
  {
    "id": 582,
    "districtId": 58,
    "typeId": 3,
    "nameEn": "Thakurbaba",
    "nameNe": "ठाकुरबाबा"
  },
  {
    "id": 583,
    "districtId": 58,
    "typeId": 3,
    "nameEn": "Basgadhi",
    "nameNe": "बाँसगढी"
  },
  {
    "id": 584,
    "districtId": 58,
    "typeId": 3,
    "nameEn": "Barbardiya",
    "nameNe": "बारबर्दिया"
  },
  {
    "id": 585,
    "districtId": 58,
    "typeId": 4,
    "nameEn": "Badhaiyatal",
    "nameNe": "बढैयाताल"
  },
  {
    "id": 586,
    "districtId": 58,
    "typeId": 4,
    "nameEn": "Geruwa",
    "nameNe": "गेरुवा"
  },
  {
    "id": 587,
    "districtId": 59,
    "typeId": 3,
    "nameEn": "Aathabiskot",
    "nameNe": "आठबिसकोट"
  },
  {
    "id": 588,
    "districtId": 59,
    "typeId": 3,
    "nameEn": "Musikot",
    "nameNe": "मुसिकोट"
  },
  {
    "id": 589,
    "districtId": 59,
    "typeId": 3,
    "nameEn": "Chaurjahari",
    "nameNe": "चौरजहारी"
  },
  {
    "id": 590,
    "districtId": 59,
    "typeId": 4,
    "nameEn": "SaniBheri",
    "nameNe": "सानी भेरी"
  },
  {
    "id": 591,
    "districtId": 59,
    "typeId": 4,
    "nameEn": "Triveni",
    "nameNe": "त्रिवेणी"
  },
  {
    "id": 592,
    "districtId": 59,
    "typeId": 4,
    "nameEn": "Banphikot",
    "nameNe": "बाँफिकोट"
  },
  {
    "id": 593,
    "districtId": 60,
    "typeId": 4,
    "nameEn": "Kumakh",
    "nameNe": "कुमाख"
  },
  {
    "id": 594,
    "districtId": 60,
    "typeId": 4,
    "nameEn": "Kalimati",
    "nameNe": "कालिमाटी"
  },
  {
    "id": 595,
    "districtId": 60,
    "typeId": 4,
    "nameEn": "Chhatreshwari",
    "nameNe": "छत्रेश्वरी"
  },
  {
    "id": 596,
    "districtId": 60,
    "typeId": 4,
    "nameEn": "Darma",
    "nameNe": "दार्मा"
  },
  {
    "id": 597,
    "districtId": 60,
    "typeId": 4,
    "nameEn": "Kapurkot",
    "nameNe": "कपुरकोट"
  },
  {
    "id": 598,
    "districtId": 60,
    "typeId": 4,
    "nameEn": "Triveni",
    "nameNe": "त्रिवेणी"
  },
  {
    "id": 599,
    "districtId": 60,
    "typeId": 4,
    "nameEn": "Siddha Kumakh",
    "nameNe": "सिद्ध कुमाख"
  },
  {
    "id": 600,
    "districtId": 60,
    "typeId": 3,
    "nameEn": "Bagchaur",
    "nameNe": "बागचौर"
  },
  {
    "id": 601,
    "districtId": 60,
    "typeId": 3,
    "nameEn": "Shaarda",
    "nameNe": "शारदा"
  },
  {
    "id": 602,
    "districtId": 60,
    "typeId": 3,
    "nameEn": "Bangad Kupinde",
    "nameNe": "बनगाड कुपिण्डे"
  },
  {
    "id": 603,
    "districtId": 61,
    "typeId": 4,
    "nameEn": "Mudkechula",
    "nameNe": "मुड्केचुला"
  },
  {
    "id": 604,
    "districtId": 61,
    "typeId": 4,
    "nameEn": "Kaike",
    "nameNe": "काईके"
  },
  {
    "id": 605,
    "districtId": 61,
    "typeId": 4,
    "nameEn": "She Phoksundo",
    "nameNe": "शे फोक्सुन्डो"
  },
  {
    "id": 606,
    "districtId": 61,
    "typeId": 4,
    "nameEn": "Jagadulla",
    "nameNe": "जगदुल्ला"
  },
  {
    "id": 607,
    "districtId": 61,
    "typeId": 4,
    "nameEn": "Dolpo Buddha",
    "nameNe": "डोल्पो बुद्ध"
  },
  {
    "id": 608,
    "districtId": 61,
    "typeId": 4,
    "nameEn": "Chharka Tongsong",
    "nameNe": "छार्का ताङसोङ"
  },
  {
    "id": 609,
    "districtId": 61,
    "typeId": 3,
    "nameEn": "Thuli Bheri",
    "nameNe": "ठूली भेरी"
  },
  {
    "id": 610,
    "districtId": 61,
    "typeId": 3,
    "nameEn": "Tripurasundari",
    "nameNe": "त्रिपुरासुन्दरी"
  },
  {
    "id": 611,
    "districtId": 62,
    "typeId": 4,
    "nameEn": "Simkot",
    "nameNe": "सिमकोट"
  },
  {
    "id": 612,
    "districtId": 62,
    "typeId": 4,
    "nameEn": "Sarkegad",
    "nameNe": "सर्केगाड"
  },
  {
    "id": 613,
    "districtId": 62,
    "typeId": 4,
    "nameEn": "Adanchuli",
    "nameNe": "अदानचुली"
  },
  {
    "id": 614,
    "districtId": 62,
    "typeId": 4,
    "nameEn": "Kharpunath",
    "nameNe": "खार्पुनाथ"
  },
  {
    "id": 615,
    "districtId": 62,
    "typeId": 4,
    "nameEn": "Tanjakot",
    "nameNe": "ताँजाकोट"
  },
  {
    "id": 616,
    "districtId": 62,
    "typeId": 4,
    "nameEn": "Chankheli",
    "nameNe": "चंखेली"
  },
  {
    "id": 617,
    "districtId": 62,
    "typeId": 4,
    "nameEn": "Namkha",
    "nameNe": "नाम्खा"
  },
  {
    "id": 618,
    "districtId": 63,
    "typeId": 4,
    "nameEn": "Tatopani",
    "nameNe": "तातोपानी"
  },
  {
    "id": 619,
    "districtId": 63,
    "typeId": 4,
    "nameEn": "Patarasi",
    "nameNe": "पातारासी"
  },
  {
    "id": 620,
    "districtId": 63,
    "typeId": 4,
    "nameEn": "Tila",
    "nameNe": "तिला"
  },
  {
    "id": 621,
    "districtId": 63,
    "typeId": 4,
    "nameEn": "Kanaka Sundari",
    "nameNe": "कनकासुन्दरी"
  },
  {
    "id": 622,
    "districtId": 63,
    "typeId": 4,
    "nameEn": "Sinja",
    "nameNe": "सिंजा"
  },
  {
    "id": 623,
    "districtId": 63,
    "typeId": 4,
    "nameEn": "Hima",
    "nameNe": "हिमा"
  },
  {
    "id": 624,
    "districtId": 63,
    "typeId": 4,
    "nameEn": "Guthichaur",
    "nameNe": "गुठिचौर"
  },
  {
    "id": 625,
    "districtId": 63,
    "typeId": 3,
    "nameEn": "Chandannath",
    "nameNe": "चन्दननाथ"
  },
  {
    "id": 626,
    "districtId": 64,
    "typeId": 3,
    "nameEn": "Khandachakra",
    "nameNe": "खाँडाचक्र"
  },
  {
    "id": 627,
    "districtId": 64,
    "typeId": 3,
    "nameEn": "Raskot",
    "nameNe": "रास्कोट"
  },
  {
    "id": 628,
    "districtId": 64,
    "typeId": 3,
    "nameEn": "Tilagufa",
    "nameNe": "तिलागुफा"
  },
  {
    "id": 629,
    "districtId": 64,
    "typeId": 4,
    "nameEn": "Narharinath",
    "nameNe": "नरहरिनाथ"
  },
  {
    "id": 630,
    "districtId": 64,
    "typeId": 4,
    "nameEn": "Palata",
    "nameNe": "पलाता"
  },
  {
    "id": 631,
    "districtId": 64,
    "typeId": 4,
    "nameEn": "Shubha Kalika",
    "nameNe": "शुभ कालीका"
  },
  {
    "id": 632,
    "districtId": 64,
    "typeId": 4,
    "nameEn": "Sanni Triveni",
    "nameNe": "सान्नी त्रिवेणी"
  },
  {
    "id": 633,
    "districtId": 64,
    "typeId": 4,
    "nameEn": "Pachaljharana",
    "nameNe": "पचालझरना"
  },
  {
    "id": 634,
    "districtId": 64,
    "typeId": 4,
    "nameEn": "Mahawai",
    "nameNe": "महावै"
  },
  {
    "id": 635,
    "districtId": 65,
    "typeId": 4,
    "nameEn": "Khatyad",
    "nameNe": "खत्याड"
  },
  {
    "id": 636,
    "districtId": 65,
    "typeId": 4,
    "nameEn": "Soru",
    "nameNe": "सोरु"
  },
  {
    "id": 637,
    "districtId": 65,
    "typeId": 4,
    "nameEn": "Mugum Karmarong",
    "nameNe": "मुगुम कार्मारोंग"
  },
  {
    "id": 638,
    "districtId": 65,
    "typeId": 3,
    "nameEn": "Chhayanath Rara",
    "nameNe": "छायाँनाथ रारा"
  },
  {
    "id": 639,
    "districtId": 66,
    "typeId": 4,
    "nameEn": "Simta",
    "nameNe": "सिम्ता"
  },
  {
    "id": 640,
    "districtId": 66,
    "typeId": 4,
    "nameEn": "Barahatal",
    "nameNe": "बराहताल"
  },
  {
    "id": 641,
    "districtId": 66,
    "typeId": 4,
    "nameEn": "Chaukune",
    "nameNe": "चौकुने"
  },
  {
    "id": 642,
    "districtId": 66,
    "typeId": 4,
    "nameEn": "Chingad",
    "nameNe": "चिङ्गाड"
  },
  {
    "id": 643,
    "districtId": 66,
    "typeId": 3,
    "nameEn": "Gurbhakot",
    "nameNe": "गुर्भाकोट"
  },
  {
    "id": 644,
    "districtId": 66,
    "typeId": 3,
    "nameEn": "Birendranagar",
    "nameNe": "बीरेन्द्रनगर"
  },
  {
    "id": 645,
    "districtId": 66,
    "typeId": 3,
    "nameEn": "Bheriganga",
    "nameNe": "भेरीगंगा"
  },
  {
    "id": 646,
    "districtId": 66,
    "typeId": 3,
    "nameEn": "Panchapuri",
    "nameNe": "पञ्चपुरी"
  },
  {
    "id": 647,
    "districtId": 66,
    "typeId": 3,
    "nameEn": "Lekbeshi",
    "nameNe": "लेकवेशी"
  },
  {
    "id": 648,
    "districtId": 67,
    "typeId": 3,
    "nameEn": "Dullu",
    "nameNe": "दुल्लु"
  },
  {
    "id": 649,
    "districtId": 67,
    "typeId": 4,
    "nameEn": "Gurans",
    "nameNe": "गुराँस"
  },
  {
    "id": 650,
    "districtId": 67,
    "typeId": 4,
    "nameEn": "Bhairabi",
    "nameNe": "भैरवी"
  },
  {
    "id": 651,
    "districtId": 67,
    "typeId": 4,
    "nameEn": "Naumule",
    "nameNe": "नौमुले"
  },
  {
    "id": 652,
    "districtId": 67,
    "typeId": 4,
    "nameEn": "Mahabu",
    "nameNe": "महावु"
  },
  {
    "id": 653,
    "districtId": 67,
    "typeId": 4,
    "nameEn": "Thantikandh",
    "nameNe": "ठाँटीकाँध"
  },
  {
    "id": 654,
    "districtId": 67,
    "typeId": 4,
    "nameEn": "Bhagawatimai",
    "nameNe": "भगवतीमाई"
  },
  {
    "id": 655,
    "districtId": 67,
    "typeId": 4,
    "nameEn": "Dungeshwar",
    "nameNe": "डुंगेश्वर"
  },
  {
    "id": 656,
    "districtId": 67,
    "typeId": 3,
    "nameEn": "Aathabis",
    "nameNe": "आठबीस"
  },
  {
    "id": 657,
    "districtId": 67,
    "typeId": 3,
    "nameEn": "Narayan",
    "nameNe": "नारायण"
  },
  {
    "id": 658,
    "districtId": 67,
    "typeId": 3,
    "nameEn": "Chamunda Bindrasaini",
    "nameNe": "चामुण्डा विन्द्रासैनी"
  },
  {
    "id": 659,
    "districtId": 68,
    "typeId": 3,
    "nameEn": "Chhedagad",
    "nameNe": "छेडागाड"
  },
  {
    "id": 660,
    "districtId": 68,
    "typeId": 3,
    "nameEn": "Bheri",
    "nameNe": "भेरी"
  },
  {
    "id": 661,
    "districtId": 68,
    "typeId": 3,
    "nameEn": "Nalgad",
    "nameNe": "नलगाड"
  },
  {
    "id": 662,
    "districtId": 68,
    "typeId": 4,
    "nameEn": "Junichande",
    "nameNe": "जुनीचाँदे"
  },
  {
    "id": 663,
    "districtId": 68,
    "typeId": 4,
    "nameEn": "Kuse",
    "nameNe": "कुसे"
  },
  {
    "id": 664,
    "districtId": 68,
    "typeId": 4,
    "nameEn": "Barekot",
    "nameNe": "बारेकोट"
  },
  {
    "id": 665,
    "districtId": 68,
    "typeId": 4,
    "nameEn": "Shivalaya",
    "nameNe": "शिवालय"
  },
  {
    "id": 666,
    "districtId": 69,
    "typeId": 3,
    "nameEn": "Mahakali",
    "nameNe": "महाकाली"
  },
  {
    "id": 667,
    "districtId": 69,
    "typeId": 3,
    "nameEn": "Shailyashikhar",
    "nameNe": "शैल्यशिखर"
  },
  {
    "id": 668,
    "districtId": 69,
    "typeId": 4,
    "nameEn": "Naugad",
    "nameNe": "नौगाड"
  },
  {
    "id": 669,
    "districtId": 69,
    "typeId": 4,
    "nameEn": "Malikarjun",
    "nameNe": "मालिकार्जुन"
  },
  {
    "id": 670,
    "districtId": 69,
    "typeId": 4,
    "nameEn": "Marma",
    "nameNe": "मार्मा"
  },
  {
    "id": 671,
    "districtId": 69,
    "typeId": 4,
    "nameEn": "Lekam",
    "nameNe": "लेकम"
  },
  {
    "id": 672,
    "districtId": 69,
    "typeId": 4,
    "nameEn": "Duhun",
    "nameNe": "दुहुँ"
  },
  {
    "id": 673,
    "districtId": 69,
    "typeId": 4,
    "nameEn": "Vyans",
    "nameNe": "ब्याँस"
  },
  {
    "id": 674,
    "districtId": 69,
    "typeId": 4,
    "nameEn": "Apihimal",
    "nameNe": "अपिहिमाल"
  },
  {
    "id": 675,
    "districtId": 70,
    "typeId": 3,
    "nameEn": "Jayaprithvi",
    "nameNe": "जयपृथ्वी"
  },
  {
    "id": 676,
    "districtId": 70,
    "typeId": 3,
    "nameEn": "Bungal",
    "nameNe": "बुंगल"
  },
  {
    "id": 677,
    "districtId": 70,
    "typeId": 4,
    "nameEn": "Kedarsyu",
    "nameNe": "केदारस्युँ"
  },
  {
    "id": 678,
    "districtId": 70,
    "typeId": 4,
    "nameEn": "Thalara",
    "nameNe": "थलारा"
  },
  {
    "id": 679,
    "districtId": 70,
    "typeId": 4,
    "nameEn": "Bitthadchir",
    "nameNe": "वित्थडचिर"
  },
  {
    "id": 680,
    "districtId": 70,
    "typeId": 4,
    "nameEn": "Chhabis Pathibhera",
    "nameNe": "छबिसपाथिभेरा"
  },
  {
    "id": 681,
    "districtId": 70,
    "typeId": 4,
    "nameEn": "Khaptadchhanna",
    "nameNe": "खप्तडछान्ना"
  },
  {
    "id": 682,
    "districtId": 70,
    "typeId": 4,
    "nameEn": "Masta",
    "nameNe": "मष्टा"
  },
  {
    "id": 683,
    "districtId": 70,
    "typeId": 4,
    "nameEn": "Durgathali",
    "nameNe": "दुर्गाथली"
  },
  {
    "id": 684,
    "districtId": 70,
    "typeId": 4,
    "nameEn": "Talkot",
    "nameNe": "तलकोट"
  },
  {
    "id": 685,
    "districtId": 70,
    "typeId": 4,
    "nameEn": "Surma",
    "nameNe": "सूर्मा"
  },
  {
    "id": 686,
    "districtId": 70,
    "typeId": 4,
    "nameEn": "Saipal",
    "nameNe": "साइपाल"
  },
  {
    "id": 687,
    "districtId": 71,
    "typeId": 3,
    "nameEn": "Badimalika",
    "nameNe": "बडीमालिका"
  },
  {
    "id": 688,
    "districtId": 71,
    "typeId": 3,
    "nameEn": "Triveni",
    "nameNe": "त्रिवेणी"
  },
  {
    "id": 689,
    "districtId": 71,
    "typeId": 3,
    "nameEn": "Budhiganga",
    "nameNe": "बुढीगंगा"
  },
  {
    "id": 690,
    "districtId": 71,
    "typeId": 3,
    "nameEn": "Budhinanda",
    "nameNe": "बुढीनन्दा"
  },
  {
    "id": 691,
    "districtId": 71,
    "typeId": 4,
    "nameEn": "Khaptad Chhededaha",
    "nameNe": "खप्तड छेडेदह"
  },
  {
    "id": 692,
    "districtId": 71,
    "typeId": 4,
    "nameEn": "Swami Kartik Khapar",
    "nameNe": "स्वामीकार्तिक खापर"
  },
  {
    "id": 693,
    "districtId": 71,
    "typeId": 4,
    "nameEn": "Jagannath",
    "nameNe": "जगन्‍नाथ"
  },
  {
    "id": 694,
    "districtId": 71,
    "typeId": 4,
    "nameEn": "Himali",
    "nameNe": "हिमाली"
  },
  {
    "id": 695,
    "districtId": 71,
    "typeId": 4,
    "nameEn": "Gaumul",
    "nameNe": "गौमुल"
  },
  {
    "id": 696,
    "districtId": 72,
    "typeId": 3,
    "nameEn": "Dashrathchanda",
    "nameNe": "दशरथचन्द"
  },
  {
    "id": 697,
    "districtId": 72,
    "typeId": 3,
    "nameEn": "Patan",
    "nameNe": "पाटन"
  },
  {
    "id": 698,
    "districtId": 72,
    "typeId": 3,
    "nameEn": "Melauli",
    "nameNe": "मेलौली"
  },
  {
    "id": 699,
    "districtId": 72,
    "typeId": 3,
    "nameEn": "Purchaudi",
    "nameNe": "पुर्चौडी"
  },
  {
    "id": 700,
    "districtId": 72,
    "typeId": 4,
    "nameEn": "Dogdakedar",
    "nameNe": "दोगडाकेदार"
  },
  {
    "id": 701,
    "districtId": 72,
    "typeId": 4,
    "nameEn": "Dilashaini",
    "nameNe": "डीलासैनी"
  },
  {
    "id": 702,
    "districtId": 72,
    "typeId": 4,
    "nameEn": "Sigas",
    "nameNe": "सिगास"
  },
  {
    "id": 703,
    "districtId": 72,
    "typeId": 4,
    "nameEn": "Pancheshwar",
    "nameNe": "पञ्चेश्वर"
  },
  {
    "id": 704,
    "districtId": 72,
    "typeId": 4,
    "nameEn": "Surnaya",
    "nameNe": "सुर्नया"
  },
  {
    "id": 705,
    "districtId": 72,
    "typeId": 4,
    "nameEn": "Shivanath",
    "nameNe": "शिवनाथ"
  },
  {
    "id": 706,
    "districtId": 73,
    "typeId": 3,
    "nameEn": "Dipayal Silgadhi",
    "nameNe": "दिपायल सिलगढी"
  },
  {
    "id": 707,
    "districtId": 73,
    "typeId": 3,
    "nameEn": "Shikhar",
    "nameNe": "शिखर"
  },
  {
    "id": 708,
    "districtId": 73,
    "typeId": 4,
    "nameEn": "Aadarsha",
    "nameNe": "आदर्श"
  },
  {
    "id": 709,
    "districtId": 73,
    "typeId": 4,
    "nameEn": "Purbichauki",
    "nameNe": "पूर्वीचौकी"
  },
  {
    "id": 710,
    "districtId": 73,
    "typeId": 4,
    "nameEn": "K.I.Singh",
    "nameNe": "के.आई.सिं."
  },
  {
    "id": 711,
    "districtId": 73,
    "typeId": 4,
    "nameEn": "Jorayal",
    "nameNe": "जोरायल"
  },
  {
    "id": 712,
    "districtId": 73,
    "typeId": 4,
    "nameEn": "Sayal",
    "nameNe": "सायल"
  },
  {
    "id": 713,
    "districtId": 73,
    "typeId": 4,
    "nameEn": "Bogatan-Phudsil",
    "nameNe": "बोगटान फुड्सिल"
  },
  {
    "id": 714,
    "districtId": 73,
    "typeId": 4,
    "nameEn": "Badikedar",
    "nameNe": "बडीकेदार"
  },
  {
    "id": 715,
    "districtId": 74,
    "typeId": 4,
    "nameEn": "Ramaroshan",
    "nameNe": "रामारोशन"
  },
  {
    "id": 716,
    "districtId": 74,
    "typeId": 4,
    "nameEn": "Chaurpati",
    "nameNe": "चौरपाटी"
  },
  {
    "id": 717,
    "districtId": 74,
    "typeId": 4,
    "nameEn": "Turmakhand",
    "nameNe": "तुर्माखाँद"
  },
  {
    "id": 718,
    "districtId": 74,
    "typeId": 4,
    "nameEn": "Mellekh",
    "nameNe": "मेल्लेख"
  },
  {
    "id": 719,
    "districtId": 74,
    "typeId": 4,
    "nameEn": "Dhakari",
    "nameNe": "ढकारी"
  },
  {
    "id": 720,
    "districtId": 74,
    "typeId": 4,
    "nameEn": "Bannigadi Jayagad",
    "nameNe": "बान्निगढी जयगढ"
  },
  {
    "id": 721,
    "districtId": 74,
    "typeId": 3,
    "nameEn": "Mangalsen",
    "nameNe": "मंगलसेन"
  },
  {
    "id": 722,
    "districtId": 74,
    "typeId": 3,
    "nameEn": "Kamalbazar",
    "nameNe": "कमलबजार"
  },
  {
    "id": 723,
    "districtId": 74,
    "typeId": 3,
    "nameEn": "Sanfebagar",
    "nameNe": "साँफेबगर"
  },
  {
    "id": 724,
    "districtId": 74,
    "typeId": 3,
    "nameEn": "Panchadewal Binayak",
    "nameNe": "पन्चदेवल विनायक"
  },
  {
    "id": 725,
    "districtId": 75,
    "typeId": 4,
    "nameEn": "Navadurga",
    "nameNe": "नवदुर्गा"
  },
  {
    "id": 726,
    "districtId": 75,
    "typeId": 4,
    "nameEn": "Aalitaal",
    "nameNe": "आलिताल"
  },
  {
    "id": 727,
    "districtId": 75,
    "typeId": 4,
    "nameEn": "Ganyapadhura",
    "nameNe": "गन्यापधुरा"
  },
  {
    "id": 728,
    "districtId": 75,
    "typeId": 4,
    "nameEn": "Bhageshwar",
    "nameNe": "भागेश्वर"
  },
  {
    "id": 729,
    "districtId": 75,
    "typeId": 4,
    "nameEn": "Ajaymeru",
    "nameNe": "अजयमेरु"
  },
  {
    "id": 730,
    "districtId": 75,
    "typeId": 3,
    "nameEn": "Amargadhi",
    "nameNe": "अमरगढी"
  },
  {
    "id": 731,
    "districtId": 75,
    "typeId": 3,
    "nameEn": "Parshuram",
    "nameNe": "परशुराम"
  },
  {
    "id": 732,
    "districtId": 76,
    "typeId": 3,
    "nameEn": "Bhimdatta",
    "nameNe": "भीमदत्त"
  },
  {
    "id": 733,
    "districtId": 76,
    "typeId": 3,
    "nameEn": "Punarbas",
    "nameNe": "पुर्नवास"
  },
  {
    "id": 734,
    "districtId": 76,
    "typeId": 3,
    "nameEn": "Bedkot",
    "nameNe": "वेदकोट"
  },
  {
    "id": 735,
    "districtId": 76,
    "typeId": 3,
    "nameEn": "Mahakali",
    "nameNe": "माहाकाली"
  },
  {
    "id": 736,
    "districtId": 76,
    "typeId": 3,
    "nameEn": "Shuklaphanta",
    "nameNe": "शुक्लाफाँटा"
  },
  {
    "id": 737,
    "districtId": 76,
    "typeId": 3,
    "nameEn": "Belauri",
    "nameNe": "बेलौरी"
  },
  {
    "id": 738,
    "districtId": 76,
    "typeId": 3,
    "nameEn": "Krishnapur",
    "nameNe": "कृष्णपुर"
  },
  {
    "id": 739,
    "districtId": 76,
    "typeId": 4,
    "nameEn": "Laljhadi",
    "nameNe": "लालझाडी"
  },
  {
    "id": 740,
    "districtId": 76,
    "typeId": 4,
    "nameEn": "Beldandi",
    "nameNe": "बेलडाडी"
  },
  {
    "id": 741,
    "districtId": 77,
    "typeId": 4,
    "nameEn": "Janaki",
    "nameNe": "जानकी"
  },
  {
    "id": 742,
    "districtId": 77,
    "typeId": 4,
    "nameEn": "Kailari",
    "nameNe": "कैलारी"
  },
  {
    "id": 743,
    "districtId": 77,
    "typeId": 4,
    "nameEn": "Joshipur",
    "nameNe": "जोशीपुर"
  },
  {
    "id": 744,
    "districtId": 77,
    "typeId": 4,
    "nameEn": "Bardagoriya",
    "nameNe": "बर्दगोरिया"
  },
  {
    "id": 745,
    "districtId": 77,
    "typeId": 4,
    "nameEn": "Mohanyal",
    "nameNe": "मोहन्याल"
  },
  {
    "id": 746,
    "districtId": 77,
    "typeId": 4,
    "nameEn": "Chure",
    "nameNe": "चुरे"
  },
  {
    "id": 747,
    "districtId": 77,
    "typeId": 3,
    "nameEn": "Tikapur",
    "nameNe": "टिकापुर"
  },
  {
    "id": 748,
    "districtId": 77,
    "typeId": 3,
    "nameEn": "Ghodaghodi",
    "nameNe": "घोडाघोडी"
  },
  {
    "id": 749,
    "districtId": 77,
    "typeId": 3,
    "nameEn": "Lamkichuha",
    "nameNe": "लम्कीचुहा"
  },
  {
    "id": 750,
    "districtId": 77,
    "typeId": 3,
    "nameEn": "Bhajni",
    "nameNe": "भजनी"
  },
  {
    "id": 751,
    "districtId": 77,
    "typeId": 3,
    "nameEn": "Godawari",
    "nameNe": "गोदावरी"
  },
  {
    "id": 752,
    "districtId": 77,
    "typeId": 3,
    "nameEn": "Gauriganga",
    "nameNe": "गौरीगंगा"
  },
  {
    "id": 753,
    "districtId": 77,
    "typeId": 2,
    "nameEn": "Dhangadhi",
    "nameNe": "धनगढी"
  }
];
