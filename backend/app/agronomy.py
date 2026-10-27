"""Static agronomic knowledge used by the rule engines.

Optimal ranges are typical values from ICAR / FAO crop guides. They drive the
'climate fit' part of the twin health score and the fallback advice.
"""

# key: dataset crop name (yield_df "Item")
CROPS = {
    "Wheat":                {"key": "wheat",       "temp": (15, 24), "rain": (450, 900),   "npk": (120, 60, 40),  "hindi": "गेहूँ"},
    "Rice, paddy":          {"key": "rice",        "temp": (22, 32), "rain": (1100, 2500), "npk": (120, 60, 40),  "hindi": "धान"},
    "Maize":                {"key": "maize",       "temp": (21, 30), "rain": (600, 1200),  "npk": (150, 75, 40),  "hindi": "मक्का"},
    "Potatoes":             {"key": "potato",      "temp": (15, 22), "rain": (500, 900),   "npk": (180, 80, 100), "hindi": "आलू"},
    "Soybeans":             {"key": "soybean",     "temp": (20, 30), "rain": (600, 1100),  "npk": (30, 60, 40),   "hindi": "सोयाबीन"},
    "Sorghum":              {"key": "sorghum",     "temp": (25, 32), "rain": (450, 900),   "npk": (80, 40, 40),   "hindi": "ज्वार"},
    "Sweet potatoes":       {"key": "sweetpotato", "temp": (21, 29), "rain": (750, 1250),  "npk": (60, 60, 120),  "hindi": "शकरकंद"},
    "Cassava":              {"key": "cassava",     "temp": (25, 32), "rain": (1000, 1800), "npk": (100, 50, 100), "hindi": "कसावा"},
    "Yams":                 {"key": "yam",         "temp": (25, 30), "rain": (1000, 1600), "npk": (80, 60, 80),   "hindi": "रतालू"},
    "Plantains and others": {"key": "plantain",    "temp": (25, 30), "rain": (1500, 2500), "npk": (200, 60, 300), "hindi": "केला"},
}

# Disease windows: (name, temp_lo, temp_hi, min_humidity, needs_rain, note)
DISEASES = {
    "wheat":       [("Yellow (stripe) rust", 10, 20, 85, False, "cool, humid nights favour rust spores"),
                    ("Powdery mildew", 15, 22, 70, False, "moderate temperature with high humidity"),
                    ("Karnal bunt", 18, 24, 70, True, "rain and humidity during heading")],
    "rice":        [("Rice blast", 24, 28, 90, False, "leaf wetness and warm nights"),
                    ("Bacterial leaf blight", 25, 34, 70, True, "storms and heavy rain spread bacteria"),
                    ("Sheath blight", 28, 32, 85, False, "hot, humid dense canopy")],
    "maize":       [("Turcicum leaf blight", 18, 27, 75, True, "moderate temperature with dew"),
                    ("Maydis leaf blight", 26, 32, 80, True, "hot and humid weather")],
    "potato":      [("Late blight", 10, 25, 90, True, "cool, wet weather — spreads in days"),
                    ("Early blight", 24, 30, 70, False, "warm with alternating wet/dry periods")],
    "soybean":     [("Soybean rust", 18, 28, 75, True, "prolonged leaf wetness"),
                    ("Anthracnose", 25, 32, 80, True, "warm rainy periods")],
    "sorghum":     [("Anthracnose", 25, 30, 80, True, "warm, humid, rainy weather"),
                    ("Grain mold", 25, 35, 85, True, "rain during grain filling")],
    "sweetpotato": [("Black rot", 23, 30, 80, False, "warm humid storage and soil")],
    "cassava":     [("Cassava bacterial blight", 22, 30, 80, True, "rain splash spreads bacteria")],
    "yam":         [("Anthracnose", 25, 30, 80, True, "warm and wet weather")],
    "plantain":    [("Sigatoka leaf spot", 25, 29, 85, True, "humid tropical conditions")],
}

# Mapping between the two datasets (yield crop -> recommendation label)
YIELD_TO_REC = {"Rice, paddy": "rice", "Maize": "maize"}

REC_HINDI = {
    "rice": "धान", "maize": "मक्का", "chickpea": "चना", "kidneybeans": "राजमा", "pigeonpeas": "अरहर",
    "mothbeans": "मोठ", "mungbean": "मूंग", "blackgram": "उड़द", "lentil": "मसूर", "pomegranate": "अनार",
    "banana": "केला", "mango": "आम", "grapes": "अंगूर", "watermelon": "तरबूज", "muskmelon": "खरबूजा",
    "apple": "सेब", "orange": "संतरा", "papaya": "पपीता", "coconut": "नारियल", "cotton": "कपास",
    "jute": "जूट", "coffee": "कॉफ़ी",
}
