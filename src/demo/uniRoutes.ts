// Generated from "Complete Buses Route FALL-2026.pdf" (FAST-NUCES Chiniot-Faisalabad campus bus routes and timings).
// Place names, departure times and authorised-person contacts are exactly as printed in the PDF.
export interface UniStop { name: string; time: string }
export interface UniRoute { number: string; note: string | null; contact: { name: string; phone: string } | null; stops: UniStop[] }

export const UNI_ROUTES: UniRoute[] = [
  {
    "number": "01",
    "note": null,
    "contact": {
      "name": "Mr. Waqas",
      "phone": "0307-7912548"
    },
    "stops": [
      {
        "name": "Chenab Garden",
        "time": "07:05"
      },
      {
        "name": "Korian Pull",
        "time": "07:11"
      },
      {
        "name": "D-Type",
        "time": "07:12"
      },
      {
        "name": "Waris Pura",
        "time": "07:17"
      },
      {
        "name": "Raja Chowk",
        "time": "07:19"
      },
      {
        "name": "Pahari Chowk",
        "time": "07:23"
      },
      {
        "name": "Babar Chowk",
        "time": "07:24"
      },
      {
        "name": "Hameed Palace",
        "time": "07:25"
      },
      {
        "name": "Mcdonald",
        "time": "07:26"
      },
      {
        "name": "Campus",
        "time": "08:25"
      }
    ]
  },
  {
    "number": "02",
    "note": null,
    "contact": {
      "name": "Mr. Hanif Shakir",
      "phone": "0300-2388900"
    },
    "stops": [
      {
        "name": "Nishatabad",
        "time": "07:10"
      },
      {
        "name": "Chowki Bazzar",
        "time": "07:12"
      },
      {
        "name": "Nigahban Pura Phatak",
        "time": "07:13"
      },
      {
        "name": "Tariqabad Phatak",
        "time": "07:15"
      },
      {
        "name": "Rafhan Mills",
        "time": "07:20"
      },
      {
        "name": "Treat Bakers",
        "time": "07:22"
      },
      {
        "name": "Kashmir Pull",
        "time": "07:25"
      },
      {
        "name": "Amin Town",
        "time": "07:28"
      },
      {
        "name": "66 Foot Bazar",
        "time": "07:31"
      },
      {
        "name": "Campus",
        "time": "08:25"
      }
    ]
  },
  {
    "number": "03",
    "note": null,
    "contact": {
      "name": "Mr. Zahid",
      "phone": "0333-6565326"
    },
    "stops": [
      {
        "name": "Millat Town",
        "time": "07:25"
      },
      {
        "name": "Total Pump",
        "time": "07:27"
      },
      {
        "name": "Green Town",
        "time": "07:29"
      },
      {
        "name": "Family Mart",
        "time": "07:40"
      },
      {
        "name": "Haq bahu Chowk",
        "time": "07:43"
      },
      {
        "name": "Campus",
        "time": "08:25"
      }
    ]
  },
  {
    "number": "04",
    "note": null,
    "contact": {
      "name": "Mr. Attiq",
      "phone": "0322-6303059"
    },
    "stops": [
      {
        "name": "4 Season",
        "time": "07:00"
      },
      {
        "name": "Total Pump (Sumandari Road)",
        "time": "07:07"
      },
      {
        "name": "Care Pharmacy",
        "time": "07:17"
      },
      {
        "name": "Madni Chowk",
        "time": "07:19"
      },
      {
        "name": "Ideal Baker",
        "time": "07:20"
      },
      {
        "name": "BC Tower",
        "time": "07:36"
      },
      {
        "name": "Campus",
        "time": "08:25"
      }
    ]
  },
  {
    "number": "05",
    "note": null,
    "contact": {
      "name": "Mr. Khalid",
      "phone": "0336-7788662"
    },
    "stops": [
      {
        "name": "Jawad Club Chowk",
        "time": "07:10"
      },
      {
        "name": "Marzi pura",
        "time": "07:15"
      },
      {
        "name": "Kashmir Road (Qabristan)",
        "time": "07:20"
      },
      {
        "name": "Nashasta Chowk",
        "time": "07:23"
      },
      {
        "name": "Mandi Morr ( Police Station)",
        "time": "07:25"
      },
      {
        "name": "Awan Chowk ( Millat School)",
        "time": "07:28"
      },
      {
        "name": "Kabootra wala Chowk",
        "time": "07:30"
      },
      {
        "name": "Chuhar Majra Mor",
        "time": "07:32"
      },
      {
        "name": "Raza Abad",
        "time": "07:35"
      },
      {
        "name": "Pakistan Chowk",
        "time": "07:37"
      },
      {
        "name": "Bara Qabristan Mor",
        "time": "07:38"
      },
      {
        "name": "SB Store",
        "time": "07:39"
      },
      {
        "name": "University Gate (Muhammad Pura)",
        "time": "07:42"
      },
      {
        "name": "Total Pump (Gulber Thana)",
        "time": "07:44"
      },
      {
        "name": "Saeed Autos ( Jail Road)",
        "time": "07:46"
      },
      {
        "name": "University main Gate (Jail Road)",
        "time": "07:48"
      },
      {
        "name": "Small State Bypass Chowk",
        "time": "08:00"
      },
      {
        "name": "Campus",
        "time": "08:25"
      }
    ]
  },
  {
    "number": "06",
    "note": null,
    "contact": {
      "name": "Mr. Qasir",
      "phone": "0343-6133984"
    },
    "stops": [
      {
        "name": "Koh-e-noor Flat",
        "time": "07:25"
      },
      {
        "name": "Abdullah Pur Pull",
        "time": "07:34"
      },
      {
        "name": "Tariqabad",
        "time": "07:35"
      },
      {
        "name": "FDA Office",
        "time": "07:40"
      },
      {
        "name": "Jamia Chishtia",
        "time": "07:48"
      },
      {
        "name": "Kohlo Wali Galli",
        "time": "07:50"
      },
      {
        "name": "Usman Colony",
        "time": "07:52"
      },
      {
        "name": "Campus",
        "time": "08:25"
      }
    ]
  },
  {
    "number": "07",
    "note": null,
    "contact": {
      "name": "Mr. Sadiq",
      "phone": "0302-7130536"
    },
    "stops": [
      {
        "name": "Faisal Garden",
        "time": "07:00"
      },
      {
        "name": "Peradise Valley",
        "time": "07:05"
      },
      {
        "name": "Wapda City",
        "time": "07:10"
      },
      {
        "name": "Ghatt Wala Pull",
        "time": "07:20"
      },
      {
        "name": "Bechonhouse",
        "time": "07:23"
      },
      {
        "name": "SOS Pull",
        "time": "07:26"
      },
      {
        "name": "Raza Garden",
        "time": "07:28"
      },
      {
        "name": "Char Chak Pul",
        "time": "07:30"
      },
      {
        "name": "Chamber Pull",
        "time": "07:32"
      },
      {
        "name": "Campus",
        "time": "08:25"
      }
    ]
  },
  {
    "number": "08",
    "note": "Chiniot",
    "contact": {
      "name": "Mr. Umar",
      "phone": "0306-7673006"
    },
    "stops": [
      {
        "name": "Station Chowk",
        "time": "07:35"
      },
      {
        "name": "Shimla Pahari",
        "time": "07:40"
      },
      {
        "name": "Emdassy Morr",
        "time": "07:42"
      },
      {
        "name": "Usman Abad",
        "time": "08:05"
      },
      {
        "name": "Mustafa Abad",
        "time": "08:06"
      },
      {
        "name": "Mandar Bazar",
        "time": "08:07"
      },
      {
        "name": "Tehsil Chowk",
        "time": "08:08"
      },
      {
        "name": "Ghala Mandi",
        "time": "08:09"
      },
      {
        "name": "Khadija Tul Kubra Hospital",
        "time": "08:10"
      },
      {
        "name": "Shamas Ul Hassan Town",
        "time": "08:11"
      },
      {
        "name": "Din Garden",
        "time": "08:12"
      },
      {
        "name": "Campus",
        "time": "08:25"
      }
    ]
  },
  {
    "number": "09",
    "note": null,
    "contact": {
      "name": "Mr. Ali",
      "phone": "0310-7418089"
    },
    "stops": [
      {
        "name": "Punjab Housing",
        "time": "07:25"
      },
      {
        "name": "Tech Town",
        "time": "07:27"
      },
      {
        "name": "Fish Farm",
        "time": "07:31"
      },
      {
        "name": "Zam Zam Hall",
        "time": "07:35"
      },
      {
        "name": "GTS",
        "time": "07:30"
      },
      {
        "name": "Cardiology",
        "time": "07:32"
      },
      {
        "name": "MTM",
        "time": "07:49"
      },
      {
        "name": "SNGPL",
        "time": "07:54"
      },
      {
        "name": "Campus",
        "time": "08:25"
      }
    ]
  },
  {
    "number": "10",
    "note": null,
    "contact": {
      "name": "Mr. Awais",
      "phone": "0344-6832248"
    },
    "stops": [
      {
        "name": "Social Security",
        "time": "07:25"
      },
      {
        "name": "Qabristan Morr",
        "time": "07:26"
      },
      {
        "name": "Mujahid Hospital",
        "time": "07:29"
      },
      {
        "name": "Green Belt",
        "time": "07:31"
      },
      {
        "name": "Faizan e Madina",
        "time": "07:33"
      },
      {
        "name": "Lasania Morr",
        "time": "07:35"
      },
      {
        "name": "Excise Office",
        "time": "07:45"
      },
      {
        "name": "Campus",
        "time": "08:25"
      }
    ]
  },
  {
    "number": "11",
    "note": null,
    "contact": {
      "name": "Mr. Akhtar",
      "phone": "0306-9091701"
    },
    "stops": [
      {
        "name": "ByPass",
        "time": "06:55"
      },
      {
        "name": "Air Port",
        "time": "07:05"
      },
      {
        "name": "Air Avenue",
        "time": "07:15"
      },
      {
        "name": "Model Bazar Pull",
        "time": "07:20"
      },
      {
        "name": "Saifabad Chungi",
        "time": "07:23"
      },
      {
        "name": "Shadab Morr",
        "time": "07:24"
      },
      {
        "name": "GulFisha Mor",
        "time": "07:25"
      },
      {
        "name": "1122",
        "time": "07:26"
      },
      {
        "name": "Lakar Mandi",
        "time": "07:27"
      },
      {
        "name": "BC Tower",
        "time": "07:35"
      },
      {
        "name": "Total pump (Jail Road)",
        "time": "07:40"
      },
      {
        "name": "KIPS Colleage (Jail Road)",
        "time": "07:41"
      },
      {
        "name": "Campus",
        "time": "08:25"
      }
    ]
  },
  {
    "number": "12",
    "note": null,
    "contact": {
      "name": "Mr. Moeen",
      "phone": "0309-7348386"
    },
    "stops": [
      {
        "name": "Manawala",
        "time": "07:10"
      },
      {
        "name": "NTU",
        "time": "07:12"
      },
      {
        "name": "Bhata Stop",
        "time": "07:15"
      },
      {
        "name": "Malik Pur",
        "time": "07:17"
      },
      {
        "name": "Nishatabad",
        "time": "07:19"
      },
      {
        "name": "Jamilabad",
        "time": "07:22"
      },
      {
        "name": "Hajiabad",
        "time": "07:23"
      },
      {
        "name": "Akbar Chowk",
        "time": "07:34"
      },
      {
        "name": "Allah Ho Daira",
        "time": "07:36"
      },
      {
        "name": "Total Pump (Millat Chowk)",
        "time": "07:44"
      },
      {
        "name": "Campus",
        "time": "08:25"
      }
    ]
  },
  {
    "number": "13",
    "note": null,
    "contact": {
      "name": "Mr. Waleed",
      "phone": "0313-4477707"
    },
    "stops": [
      {
        "name": "Larrie Adda Bus Stand",
        "time": "07:46"
      },
      {
        "name": "Chinioti Road",
        "time": "07:56"
      },
      {
        "name": "Rajoa Chaowk",
        "time": "07:58"
      },
      {
        "name": "Janaza Gah",
        "time": "08:00"
      },
      {
        "name": "Jhumra Chowk",
        "time": "08:03"
      },
      {
        "name": "Fatima Chowk",
        "time": "08:05"
      },
      {
        "name": "Campus",
        "time": "08:25"
      }
    ]
  },
  {
    "number": "14",
    "note": null,
    "contact": {
      "name": "Mr. Yaseen",
      "phone": "0303-5736637"
    },
    "stops": [
      {
        "name": "Rachna Town",
        "time": "07:13"
      },
      {
        "name": "Nadeem Café",
        "time": "07:15"
      },
      {
        "name": "Muhammad Abad",
        "time": "07:16"
      },
      {
        "name": "Saleemi Chowk",
        "time": "07:20"
      },
      {
        "name": "Gourmet Bakery",
        "time": "07:21"
      },
      {
        "name": "Campus",
        "time": "08:25"
      }
    ]
  },
  {
    "number": "15",
    "note": null,
    "contact": {
      "name": "Mr. Usman",
      "phone": "0300-9669887"
    },
    "stops": [
      {
        "name": "Shell Pump - Lasani Pulli",
        "time": "07:45"
      },
      {
        "name": "Honda showroom",
        "time": "07:51"
      },
      {
        "name": "PMC Colony Gate",
        "time": "07:53"
      },
      {
        "name": "5-Pulli Punjab College",
        "time": "07:54"
      },
      {
        "name": "Total Pump (Daewoo Road)",
        "time": "07:55"
      },
      {
        "name": "Sitra Sapna",
        "time": "07:57"
      },
      {
        "name": "HBL -Ismail Markaz",
        "time": "07:58"
      },
      {
        "name": "Ismail City",
        "time": "08:00"
      },
      {
        "name": "Islamil Valey",
        "time": "08:03"
      },
      {
        "name": "Campus",
        "time": "08:25"
      }
    ]
  },
  {
    "number": "16",
    "note": null,
    "contact": {
      "name": "Mr. Ghazi",
      "phone": "0309-6297398"
    },
    "stops": [
      {
        "name": "PMC Bridge",
        "time": "07:50"
      },
      {
        "name": "Muslim Town 2",
        "time": "07:55"
      },
      {
        "name": "Bawa Chak",
        "time": "07:56"
      },
      {
        "name": "Dawood Mill",
        "time": "07:57"
      },
      {
        "name": "KIA Show Room",
        "time": "07:58"
      },
      {
        "name": "Samana Pull",
        "time": "07:59"
      },
      {
        "name": "FDA City",
        "time": "08:03"
      },
      {
        "name": "Motorway City",
        "time": "08:05"
      },
      {
        "name": "Citi Housing",
        "time": "08:08"
      },
      {
        "name": "Campus",
        "time": "08:25"
      }
    ]
  },
  {
    "number": "17",
    "note": null,
    "contact": null,
    "stops": [
      {
        "name": "Abdullah Pull",
        "time": "07:10"
      },
      {
        "name": "Navalti Pull",
        "time": "07:15"
      },
      {
        "name": "Gao Shala",
        "time": "07:20"
      },
      {
        "name": "Khawaja Travel",
        "time": "07:23"
      },
      {
        "name": "Chenab Chowk",
        "time": "07:25"
      },
      {
        "name": "Khawaja Medical",
        "time": "07:26"
      },
      {
        "name": "Bakar Mandi",
        "time": "07:28"
      },
      {
        "name": "National Hospital",
        "time": "07:30"
      },
      {
        "name": "Riaz-Ul-Janah",
        "time": "07:45"
      },
      {
        "name": "Campus",
        "time": "08:25"
      }
    ]
  }
];
