export interface WorkingHours {
  day?: string;
  dayNumber?: number;
  dayName?: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

// API Response interface for WorkShop Working Hours
export interface WorkShopWorkingHoursAPI {
  day: string;
  from: string; // ISO 8601 time string
  to: string;   // ISO 8601 time string
  isClosed: boolean;
  workShopProfileId: number;
}

export interface WorkshopLocation {
  governorate: string;
  city: string;
  latitude: number;
  longitude: number;
  address?: string;
}

export interface WorkshopProfileData {
  id?: string;
  workshopName: string;
  workshopType: string;
  phoneNumber: string;
  NumbersOfTechnicians: number;
  description: string;
  workingHours: WorkingHours[];
  location: WorkshopLocation;
  galleryImages: string[];
  LicenceImageUrl?: string;
  isVerified?: boolean;
  Rating?: number;
  LogoImageUrl?: string;
  Country: string;
  VerificationStatus: 'Pending' | 'Verified' | 'Rejected';
  CreatedAt?: Date;
  UpdatedAt?: Date;
  ApplicationUserId?: string;
}

export const WORKSHOP_TYPES = [
  'Independent',
  'MaintainanceCenter',
  'Specialized',
  'Mobile'
];

export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

export const GOVERNORATES = [
  'Cairo',
  'Giza',
  'Alexandria',
  'Dakahlia',
  'Red Sea',
  'Beheira',
  'Fayoum',
  'Gharbia',
  'Ismailia',
  'Menofia',
  'Minya',
  'Qaliubiya',
  'New Valley',
  'Suez',
  'Aswan',
  'Assiut',
  'Beni Suef',
  'Port Said',
  'Damietta',
  'Sharkia',
  'South Sinai',
  'Kafr El Sheikh',
  'Matrouh',
  'Luxor',
  'Qena',
  'North Sinai',
  'Sohag'
];

export const EGYPTIAN_CITIES_BY_GOVERNORATE: { [key: string]: string[] } = {
  'Cairo': [
    'Nasr City', 'Heliopolis', 'Maadi', 'Zamalek', 'Downtown Cairo', 'New Cairo',
    'Sixth of October', 'Helwan', 'Shubra', 'Ain Shams', 'Hadayek El Kobba',
    'El Matareya', 'El Salam City', 'El Zeitoun', 'El Marg', 'El Sharabiya',
    'Manshiyat Naser', 'El Mokattam', 'El Basatin', 'Dar El Salam', 'Masr El Kadima',
    'El Khalifa', 'El Sayeda Zeinab', 'El Azbakeya', 'El Daher', 'El Zaher',
    'Rod El Farag', 'El Sahel', 'El Zawya El Hamra', 'Hadayek El Qobba', 'El Wayli',
    'Imbaba', 'Boulaq', 'Agouza', 'Dokki', 'Garden City', 'Abbassia', 'Ghamra',
    'Ramses', 'El Mohandessin', 'El Haram', 'Faisal', 'New Heliopolis', 'Sheraton',
    'El Nozha', 'El Tagamoa El Khames', 'El Rehab', 'Madinaty', 'Shorouk', 'Badr City'
  ],
  'Giza': [
    'Dokki', 'Mohandessin', 'Agouza', 'Haram', 'Faisal', 'Sixth of October City',
    'Sheikh Zayed', 'Imbaba', 'Boulaq El Dakrour', 'El Warraq', 'Kerdasa', 'Abu Nomros',
    'Kafr Ghati', 'Manyal Shiha', 'Awsim', 'Badrashein', 'Atfih', 'El Saff', 'Dahshur',
    'El Bahariya', 'El Ayat', 'Hawamdiyah', 'Smart Village', 'New Giza', 'October Gardens',
    'Zayed Dunes', 'Dreamland', 'Beverly Hills', 'Arkan', 'Palm Hills', 'Sodic West',
    'El Remaya Square', 'El Tahrir', 'Mit Okba', 'Mansuriyah', 'Wardan', 'Saft El Laban',
    'Kafr Tohormos', 'Monib', 'Sakiat Mekki', 'El Munira', 'El Kit Kat', 'El Moneeb',
    'Pyramids', 'Nazlet El Semman', 'Abu Rawash', 'Al Wahat', 'Haraneya'
  ],
  'Alexandria': [
    'Montaza', 'Mandara', 'Asafra', 'Sidi Bishr', 'Miami', 'San Stefano', 'Glim',
    'Sidi Gaber', 'Camp Shezar', 'Sporting', 'Smouha', 'Victoria', 'Cleopatra',
    'Roushdy', 'Louran', 'Bab Sharqi', 'Azarita', 'Raml Station', 'Attarine',
    'Manshia', 'Anfushi', 'Ras El Tin', 'Bahary', 'Gomrok', 'Mina El Basal',
    'Karmouz', 'Moharram Bek', 'Shatby', 'Ibrahimiya', 'Cleopatra', 'Sidi Bishr Qebli',
    'Sidi Bishr Bahri', 'Asafra Bahri', 'Mandara Bahri', 'Montaza Bahri', 'El Agamy',
    'Hannoville', 'Sidi Kreir', 'Amreya', 'Borg El Arab', 'New Borg El Arab',
    'King Mariout', 'Max', 'Dekheila', 'El Ameriya', 'Gharbial', 'Abu Youssef',
    'El Bitash', 'Abis', 'Sidi Gaber Qebli'
  ],
  'Dakahlia': [
    'Mansoura', 'Talkha', 'Mit Ghamr', 'Dekernes', 'Aga', 'Manzala', 'Belqas',
    'Sherbin', 'Matariya', 'Minyet El Nasr', 'Gamasa', 'Nabaroh', 'Tima',
    'Simbellawein', 'El Kurdi', 'Dirab Negm', 'Mit Salsil', 'Bilqas'
  ],
  'Red Sea': [
    'Hurghada', 'Safaga', 'El Quseir', 'Marsa Alam', 'Ras Ghareb', 'Shalatin',
    'Halayeb', 'Abu Ramad', 'El Gouna', 'Soma Bay', 'Makadi Bay', 'Sahl Hasheesh'
  ],
  'Beheira': [
    'Damanhour', 'Kafr El Dawwar', 'Rosetta', 'Edko', 'Abu Hummus', 'Delengat',
    'Mahmoudiyah', 'Rahmaniyah', 'Itay El Barod', 'Hosh Eissa', 'Shubrakhit',
    'Kom Hamada', 'Badr', 'Wadi El Natrun', 'El Nubariya', 'Abu El Matamir'
  ],
  'Fayoum': [
    'Fayoum City', 'Ibsheway', 'Itsa', 'Snores', 'Tamiya', 'Yusuf El Sediaq',
    'Qarun', 'Tunis Village', 'Wadi El Rayan', 'Wadi El Hitan'
  ],
  'Gharbia': [
    'Tanta', 'Mahalla El Kubra', 'Kafr El Zayat', 'Zefta', 'Samanoud', 'Qutour',
    'Basyoun', 'El Santa'
  ],
  'Ismailia': [
    'Ismailia City', 'Fayed', 'Qantara Sharq', 'Qantara Gharb', 'Abu Suweir',
    'Kasassin', 'Nefesha', 'Sheikh Zuweid'
  ],
  'Menofia': [
    'Shebin El Kom', 'Menouf', 'Ashmoun', 'Quesna', 'Berket El Saba', 'Tala',
    'El Bagour', 'Sers El Lyan', 'El Shohada', 'Sadat City'
  ],
  'Minya': [
    'Minya City', 'Mallawi', 'Samalut', 'Matai', 'Bani Mazar', 'Abu Qirqas',
    'Maghagha', 'Deir Mawas', 'Ard Sultan', 'New Minya'
  ],
  'Qaliubiya': [
    'Banha', 'Qalyub', 'Shubra El Kheima', 'Khanka', 'Qaha', 'Kafr Shukr',
    'Shibin El Qanater', 'Toukh', 'Obour City', 'Khosous', 'Mostorod'
  ],
  'New Valley': [
    'Kharga', 'Dakhla', 'Farafra', 'Balat', 'Paris', 'Baris', 'El Qasr'
  ],
  'Suez': [
    'Suez City', 'Ain Sokhna', 'Ataqah', 'Faisal', 'Ganayen', 'Arbaeen'
  ],
  'Aswan': [
    'Aswan City', 'Kom Ombo', 'Daraw', 'Nasr El Nuba', 'Edfu', 'Abu Simbel',
    'Kalabsha', 'Basilia'
  ],
  'Assiut': [
    'Assiut City', 'Dairut', 'Qusiya', 'Manfalut', 'Abnub', 'Abu Tig', 'Sahel Selim',
    'El Badari', 'Sodfa', 'El Ghanayem', 'New Assiut'
  ],
  'Beni Suef': [
    'Beni Suef City', 'Beba', 'Fashn', 'Ehnasia', 'Somosta', 'Nasser', 'New Beni Suef'
  ],
  'Port Said': [
    'Port Said City', 'Port Fouad', 'El Arab', 'El Zohour', 'El Manakh', 'El Sharq',
    'El Dawahy', 'Mubarak'
  ],
  'Damietta': [
    'Damietta City', 'New Damietta', 'Ras El Bar', 'Faraskur', 'Zarqa', 'Kafr Saad',
    'Kafr El Batikh', 'Azbet El Burg', 'Mit Abu Ghaleb'
  ],
  'Sharkia': [
    'Zagazig', 'Tenth of Ramadan City', 'Bilbais', 'Minya El Qamh', 'Abu Hammad',
    'Faqous', 'Kafr Saqr', 'Abu Kabir', 'Hehya', 'Diarb Negm', 'Mashtoul El Souq',
    'El Ibrahimiya', 'Awlad Saqr', 'El Husainiya', 'San El Hagar', 'El Qanayat',
    'El Qurayn'
  ],
  'South Sinai': [
    'Sharm El Sheikh', 'Dahab', 'Nuweiba', 'Taba', 'Saint Catherine', 'Abu Rudeis',
    'Abu Zenima', 'Ras Sidr', 'Tor'
  ],
  'Kafr El Sheikh': [
    'Kafr El Sheikh City', 'Desouk', 'Fuwwah', 'Metoubes', 'Baltim', 'Sidi Salem',
    'Hamoul', 'Biyala', 'Qallin', 'Riyadh'
  ],
  'Matrouh': [
    'Marsa Matrouh', 'El Alamein', 'Siwa Oasis', 'El Hamam', 'Sidi Abdel Rahman',
    'Dabaa', 'El Negila', 'Sallum', 'Barani', 'Siwa'
  ],
  'Luxor': [
    'Luxor City', 'Karnak', 'Esna', 'Armant', 'El Tod', 'El Bayadiya', 'El Qarna',
    'New Luxor'
  ],
  'Qena': [
    'Qena City', 'Nag Hammadi', 'Qus', 'Deshna', 'Abu Tesht', 'Farshut', 'Naqada',
    'El Waqf', 'Qeft', 'New Qena'
  ],
  'North Sinai': [
    'Arish', 'Rafah', 'Sheikh Zuweid', 'Bir al-Abed', 'Nekhel', 'Hasana', 'Rumana'
  ],
  'Sohag': [
    'Sohag City', 'Akhmim', 'Girga', 'Balyana', 'El Maragha', 'Tahta', 'Juhayna',
    'Dar El Salam', 'Sakolta', 'El Monsha', 'Tima', 'New Sohag'
  ]
};
