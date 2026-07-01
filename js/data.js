/*
 * ============================================================
 *  EDITABLE FILE — menu, gallery & review content
 * ------------------------------------------------------------
 *  Filled by Researcher apply step. See Researcher/runs/<slug>/research.json
 * ============================================================
 */
window.MENU_CATEGORIES = [
  {
    "id": "popular",
    "name": {
      "en": "Popular",
      "vi": "Phổ biến"
    }
  },
  {
    "id": "breakfast",
    "name": {
      "en": "Breakfast",
      "vi": "Bữa sáng"
    }
  },
  {
    "id": "starters",
    "name": {
      "en": "Starters & extras",
      "vi": "Khai vị & món thêm"
    }
  },
  {
    "id": "mains",
    "name": {
      "en": "Mains",
      "vi": "Món chính"
    }
  },
  {
    "id": "pizza-pasta",
    "name": {
      "en": "Pizza & pasta",
      "vi": "Pizza & mì Ý"
    }
  },
  {
    "id": "desserts",
    "name": {
      "en": "Desserts",
      "vi": "Tráng miệng"
    }
  },
  {
    "id": "smoothies",
    "name": {
      "en": "Smoothies & juice blends",
      "vi": "Sinh tố & nước ép mix"
    }
  },
  {
    "id": "cocktails",
    "name": {
      "en": "Cocktails & mocktails",
      "vi": "Cocktail & mocktail"
    }
  },
  {
    "id": "drinks",
    "name": {
      "en": "Drinks",
      "vi": "Đồ uống"
    }
  }
];

window.MENU_ITEMS = [
  {
    "id": "veganpho",
    "cat": "popular",
    "price": 70000,
    "emoji": "🍜",
    "base": "assets/menu/veganpho",
    "widths": [480, 960],
    "w": 768,
    "h": 1024,
    "image": "assets/menu/veganpho-960.webp",
    "tags": [
      "popular"
    ],
    "name": {
      "en": "Vegan Pho",
      "vi": "Phở chay"
    },
    "desc": {
      "en": "Vietnamese noodle soup with vegetables, herbs and soy sauce.",
      "vi": "Vietnamese noodle soup with vegetables, herbs and soy sauce."
    }
  },
  {
    "id": "chickpeacurry",
    "cat": "popular",
    "price": 90000,
    "emoji": "🍛",
    "base": "assets/menu/chickpeacurry",
    "widths": [480, 960],
    "w": 779,
    "h": 1024,
    "image": "assets/menu/chickpeacurry-960.webp",
    "tags": [
      "popular"
    ],
    "name": {
      "en": "Chickpea curry",
      "vi": "Cà ri đậu gà"
    },
    "desc": {
      "en": "Curried chickpea in coconut tomato base with brown rice and salad.",
      "vi": "Curried chickpea in coconut tomato base with brown rice and salad."
    }
  },
  {
    "id": "buddhabowl",
    "cat": "popular",
    "price": 95000,
    "emoji": "🥗",
    "base": "assets/menu/buddhabowl",
    "widths": [480, 960],
    "w": 768,
    "h": 1024,
    "image": "assets/menu/buddhabowl-960.webp",
    "tags": [
      "popular"
    ],
    "name": {
      "en": "Buddha bowl",
      "vi": "Bát Buddha"
    },
    "desc": {
      "en": "Brown rice with chickpea, pumpkin, avocado, black beans and salad.",
      "vi": "Brown rice with chickpea, pumpkin, avocado, black beans and salad."
    }
  },
  {
    "id": "specialveganpizza",
    "cat": "popular",
    "price": 120000,
    "emoji": "🍕",
    "base": "assets/menu/specialveganpizza",
    "widths": [480, 960],
    "w": 878,
    "h": 1024,
    "image": "assets/menu/specialveganpizza-960.webp",
    "tags": [
      "popular"
    ],
    "name": {
      "en": "Special Vegan Pizza",
      "vi": "Pizza chay đặc biệt"
    },
    "desc": {
      "en": "Housemade vegan cheese, tomato, capsicum, vegan ham, corn and olives.",
      "vi": "Housemade vegan cheese, tomato, capsicum, vegan ham, corn and olives."
    }
  },
  {
    "id": "specialofthefishermansta",
    "cat": "popular",
    "price": 140000,
    "emoji": "⭐",
    "base": "assets/menu/specialofthefishermansta",
    "widths": [480, 960],
    "w": 768,
    "h": 1024,
    "image": "assets/menu/specialofthefishermansta-960.webp",
    "tags": [
      "popular"
    ],
    "name": {
      "en": "Special of the Fisherman starter",
      "vi": "Món khai vị Fisherman đặc biệt"
    },
    "desc": {
      "en": "Falafel, spring rolls, salad, bread, potatoes with hummus, guacamole and chutney.",
      "vi": "Falafel, spring rolls, salad, bread, potatoes with hummus, guacamole and chutney."
    }
  },
  {
    "id": "veganpancakes",
    "cat": "popular",
    "price": 70000,
    "emoji": "🥞",
    "base": "assets/menu/veganpancakes",
    "widths": [480, 960],
    "w": 767,
    "h": 1024,
    "image": "assets/menu/veganpancakes-960.webp",
    "tags": [
      "popular"
    ],
    "name": {
      "en": "Vegan pancakes",
      "vi": "Bánh pancake chay"
    },
    "desc": {
      "en": "Banana oatmeal pancakes with fruit, coconut and house coconut yogurt.",
      "vi": "Banana oatmeal pancakes with fruit, coconut and house coconut yogurt."
    }
  },
  {
    "id": "peanutbuttertoasts",
    "cat": "breakfast",
    "price": 60000,
    "emoji": "🍽️",
    "base": "assets/menu/peanutbuttertoasts",
    "widths": [480, 960],
    "w": 1024,
    "h": 768,
    "image": "assets/menu/peanutbuttertoasts-960.webp",
    "tags": [],
    "name": {
      "en": "Peanut butter toasts",
      "vi": "Peanut butter toasts"
    },
    "desc": {
      "en": "Peanut butter, strawberry, banana and chia seeds on toasted brown bread.",
      "vi": "Peanut butter, strawberry, banana and chia seeds on toasted brown bread."
    }
  },
  {
    "id": "beetroothummustoasts",
    "cat": "breakfast",
    "price": 60000,
    "emoji": "🍽️",
    "base": "assets/menu/beetroothummustoasts",
    "widths": [480, 960],
    "w": 768,
    "h": 1024,
    "image": "assets/menu/beetroothummustoasts-960.webp",
    "tags": [],
    "name": {
      "en": "Beetroot hummus toasts",
      "vi": "Beetroot hummus toasts"
    },
    "desc": {
      "en": "Housemade beetroot hummus and grilled mushroom on toasted brown bread.",
      "vi": "Housemade beetroot hummus and grilled mushroom on toasted brown bread."
    }
  },
  {
    "id": "avotoasts",
    "cat": "breakfast",
    "price": 60000,
    "emoji": "🍽️",
    "base": "assets/menu/avotoasts",
    "widths": [480, 960],
    "w": 1024,
    "h": 768,
    "image": "assets/menu/avotoasts-960.webp",
    "tags": [],
    "name": {
      "en": "Avo toasts",
      "vi": "Avo toasts"
    },
    "desc": {
      "en": "Avocado smashed with lime on toasted brown bread.",
      "vi": "Avocado smashed with lime on toasted brown bread."
    }
  },
  {
    "id": "spicychickpeatoast",
    "cat": "breakfast",
    "price": 60000,
    "emoji": "🍽️",
    "base": "assets/menu/spicychickpeatoast",
    "widths": [480, 960],
    "w": 1024,
    "h": 767,
    "image": "assets/menu/spicychickpeatoast-960.webp",
    "tags": [],
    "name": {
      "en": "Spicy chickpea toast",
      "vi": "Spicy chickpea toast"
    },
    "desc": {
      "en": "Chickpea, chilli, tomato chutney and vegan yogurt on toast.",
      "vi": "Chickpea, chilli, tomato chutney and vegan yogurt on toast."
    }
  },
  {
    "id": "freshfruitbowl",
    "cat": "breakfast",
    "price": 60000,
    "emoji": "🍽️",
    "tags": [],
    "name": {
      "en": "Fresh fruit bowl",
      "vi": "Fresh fruit bowl"
    },
    "desc": {
      "en": "Seasonal fruits and mint.",
      "vi": "Seasonal fruits and mint."
    }
  },
  {
    "id": "strawesomesmoothiebowl",
    "cat": "breakfast",
    "price": 70000,
    "emoji": "🍽️",
    "base": "assets/menu/strawesomesmoothiebowl",
    "widths": [480, 960],
    "w": 768,
    "h": 1024,
    "image": "assets/menu/strawesomesmoothiebowl-960.webp",
    "tags": [],
    "name": {
      "en": "Strawesome smoothie bowl",
      "vi": "Strawesome smoothie bowl"
    },
    "desc": {
      "en": "Banana and strawberry base with peanut butter, oats, fruit, chia, coconut and yogurt.",
      "vi": "Banana and strawberry base with peanut butter, oats, fruit, chia, coconut and yogurt."
    }
  },
  {
    "id": "sunrisesmoothiebowl",
    "cat": "breakfast",
    "price": 80000,
    "emoji": "🍽️",
    "tags": [],
    "name": {
      "en": "Sunrise smoothie bowl",
      "vi": "Sunrise smoothie bowl"
    },
    "desc": {
      "en": "Mango smoothie base with peanut butter, oats, fruit, chia, coconut and yogurt.",
      "vi": "Mango smoothie base with peanut butter, oats, fruit, chia, coconut and yogurt."
    }
  },
  {
    "id": "pinklovesmoothiebowl",
    "cat": "breakfast",
    "price": 80000,
    "emoji": "🍽️",
    "base": "assets/menu/pinklovesmoothiebowl",
    "widths": [480, 960],
    "w": 768,
    "h": 1024,
    "image": "assets/menu/pinklovesmoothiebowl-960.webp",
    "tags": [],
    "name": {
      "en": "Pink Love smoothie bowl",
      "vi": "Pink Love smoothie bowl"
    },
    "desc": {
      "en": "Red dragon fruit and banana base with peanut butter, oats, fruit and yogurt.",
      "vi": "Red dragon fruit and banana base with peanut butter, oats, fruit and yogurt."
    }
  },
  {
    "id": "brekkyburrito",
    "cat": "breakfast",
    "price": 80000,
    "emoji": "🍽️",
    "base": "assets/menu/brekkyburrito",
    "widths": [480, 960],
    "w": 857,
    "h": 1024,
    "image": "assets/menu/brekkyburrito-960.webp",
    "tags": [],
    "name": {
      "en": "Brekky burrito",
      "vi": "Brekky burrito"
    },
    "desc": {
      "en": "Tofu scramble, black bean, capsicum, tomato and avocado in house wrap.",
      "vi": "Tofu scramble, black bean, capsicum, tomato and avocado in house wrap."
    }
  },
  {
    "id": "crispypotatoesbreakfast",
    "cat": "breakfast",
    "price": 80000,
    "emoji": "🍽️",
    "tags": [],
    "name": {
      "en": "Crispy potatoes (breakfast)",
      "vi": "Crispy potatoes (breakfast)"
    },
    "desc": {
      "en": "Crispy potatoes and chickpeas with paprika, spinach, tomatoes and kidney beans.",
      "vi": "Crispy potatoes and chickpeas with paprika, spinach, tomatoes and kidney beans."
    }
  },
  {
    "id": "tofuscrambledwithveggies",
    "cat": "breakfast",
    "price": 80000,
    "emoji": "🍽️",
    "tags": [],
    "name": {
      "en": "Tofu scrambled with veggies",
      "vi": "Tofu scrambled with veggies"
    },
    "desc": {
      "en": "Tofu scramble with turmeric, capsicum, onion, tomato and mushroom with brown bread.",
      "vi": "Tofu scramble with turmeric, capsicum, onion, tomato and mushroom with brown bread."
    }
  },
  {
    "id": "veganquesadilla",
    "cat": "breakfast",
    "price": 90000,
    "emoji": "🍽️",
    "base": "assets/menu/veganquesadilla",
    "widths": [480, 960],
    "w": 773,
    "h": 1024,
    "image": "assets/menu/veganquesadilla-960.webp",
    "tags": [],
    "name": {
      "en": "Vegan quesadilla",
      "vi": "Vegan quesadilla"
    },
    "desc": {
      "en": "Black bean, corn, tomato, capsicum, avocado and housemade vegan cheese in tortillas.",
      "vi": "Black bean, corn, tomato, capsicum, avocado and housemade vegan cheese in tortillas."
    }
  },
  {
    "id": "brownriceextra",
    "cat": "starters",
    "price": 10000,
    "emoji": "🍚",
    "tags": [],
    "name": {
      "en": "Brown rice (extra)",
      "vi": "Brown rice (extra)"
    },
    "desc": {
      "en": "Side of brown rice.",
      "vi": "Side of brown rice."
    }
  },
  {
    "id": "sauteedmorninggloryextra",
    "cat": "starters",
    "price": 20000,
    "emoji": "🥬",
    "tags": [],
    "name": {
      "en": "Sautéed morning glory (extra)",
      "vi": "Sautéed morning glory (extra)"
    },
    "desc": {
      "en": "Side of morning glory.",
      "vi": "Side of morning glory."
    }
  },
  {
    "id": "crispypotatoesextra",
    "cat": "starters",
    "price": 20000,
    "emoji": "🥔",
    "tags": [],
    "name": {
      "en": "Crispy potatoes (extra)",
      "vi": "Crispy potatoes (extra)"
    },
    "desc": {
      "en": "Side of crispy potatoes.",
      "vi": "Side of crispy potatoes."
    }
  },
  {
    "id": "grilledtofuextra",
    "cat": "starters",
    "price": 20000,
    "emoji": "🧈",
    "tags": [],
    "name": {
      "en": "Grilled tofu (extra)",
      "vi": "Grilled tofu (extra)"
    },
    "desc": {
      "en": "Side of grilled tofu.",
      "vi": "Side of grilled tofu."
    }
  },
  {
    "id": "brownbreadextra",
    "cat": "starters",
    "price": 25000,
    "emoji": "🍞",
    "tags": [],
    "name": {
      "en": "Brown bread (extra)",
      "vi": "Brown bread (extra)"
    },
    "desc": {
      "en": "Side of vegan brown bread.",
      "vi": "Side of vegan brown bread."
    }
  },
  {
    "id": "hummusextra",
    "cat": "starters",
    "price": 25000,
    "emoji": "🫘",
    "tags": [],
    "name": {
      "en": "Hummus (extra)",
      "vi": "Hummus (extra)"
    },
    "desc": {
      "en": "Side of hummus.",
      "vi": "Side of hummus."
    }
  },
  {
    "id": "sauteedmushroomsextra",
    "cat": "starters",
    "price": 25000,
    "emoji": "🍄",
    "tags": [],
    "name": {
      "en": "Sautéed mushrooms (extra)",
      "vi": "Sautéed mushrooms (extra)"
    },
    "desc": {
      "en": "Side of sautéed mushrooms.",
      "vi": "Side of sautéed mushrooms."
    }
  },
  {
    "id": "guacamoleextra",
    "cat": "starters",
    "price": 30000,
    "emoji": "🥑",
    "tags": [],
    "name": {
      "en": "Guacamole (extra)",
      "vi": "Guacamole (extra)"
    },
    "desc": {
      "en": "Side of guacamole.",
      "vi": "Side of guacamole."
    }
  },
  {
    "id": "falafel3pcsextra",
    "cat": "starters",
    "price": 30000,
    "emoji": "🧆",
    "tags": [],
    "name": {
      "en": "Falafel (3 pcs, extra)",
      "vi": "Falafel (3 pcs, extra)"
    },
    "desc": {
      "en": "Three falafel pieces.",
      "vi": "Three falafel pieces."
    }
  },
  {
    "id": "avocadoextra",
    "cat": "starters",
    "price": 30000,
    "emoji": "🥑",
    "tags": [],
    "name": {
      "en": "Avocado (extra)",
      "vi": "Avocado (extra)"
    },
    "desc": {
      "en": "Side of avocado.",
      "vi": "Side of avocado."
    }
  },
  {
    "id": "sweetpotatofries",
    "cat": "starters",
    "price": 50000,
    "emoji": "🍟",
    "tags": [],
    "name": {
      "en": "Sweet potato fries",
      "vi": "Sweet potato fries"
    },
    "desc": {
      "en": "Sweet potato chips with vegan mayo and tomato chutney.",
      "vi": "Sweet potato chips with vegan mayo and tomato chutney."
    }
  },
  {
    "id": "frenchfries",
    "cat": "starters",
    "price": 50000,
    "emoji": "🍟",
    "base": "assets/menu/frenchfries",
    "widths": [480, 960],
    "w": 1024,
    "h": 768,
    "image": "assets/menu/frenchfries-960.webp",
    "tags": [],
    "name": {
      "en": "French fries",
      "vi": "French fries"
    },
    "desc": {
      "en": "French fries with vegan mayo and tomato chutney.",
      "vi": "French fries with vegan mayo and tomato chutney."
    }
  },
  {
    "id": "dipyourbread",
    "cat": "starters",
    "price": 60000,
    "emoji": "🍽️",
    "tags": [],
    "name": {
      "en": "Dip your bread",
      "vi": "Dip your bread"
    },
    "desc": {
      "en": "Vegan brown bread with hummus, guacamole and tomato chutney.",
      "vi": "Vegan brown bread with hummus, guacamole and tomato chutney."
    }
  },
  {
    "id": "dipyourtortillas",
    "cat": "starters",
    "price": 60000,
    "emoji": "🍽️",
    "base": "assets/menu/dipyourtortillas",
    "widths": [480, 960],
    "w": 768,
    "h": 1024,
    "image": "assets/menu/dipyourtortillas-960.webp",
    "tags": [],
    "name": {
      "en": "Dip your tortillas",
      "vi": "Dip your tortillas"
    },
    "desc": {
      "en": "Tortillas with hummus, guacamole and beetroot hummus.",
      "vi": "Tortillas with hummus, guacamole and beetroot hummus."
    }
  },
  {
    "id": "freshspringrolls6pcs",
    "cat": "starters",
    "price": 65000,
    "emoji": "🍽️",
    "base": "assets/menu/freshspringrolls6pcs",
    "widths": [480, 960],
    "w": 1024,
    "h": 768,
    "image": "assets/menu/freshspringrolls6pcs-960.webp",
    "tags": [],
    "name": {
      "en": "Fresh spring rolls (6 pcs)",
      "vi": "Fresh spring rolls (6 pcs)"
    },
    "desc": {
      "en": "Lettuce, tofu, noodles, kimchi and cucumber with tahini.",
      "vi": "Lettuce, tofu, noodles, kimchi and cucumber with tahini."
    }
  },
  {
    "id": "friedvegetablespringroll",
    "cat": "starters",
    "price": 65000,
    "emoji": "🍽️",
    "tags": [],
    "name": {
      "en": "Fried vegetable spring rolls (6 pcs)",
      "vi": "Fried vegetable spring rolls (6 pcs)"
    },
    "desc": {
      "en": "Rice paper rolls with carrot, onion and mushroom; sweet & sour sauce.",
      "vi": "Rice paper rolls with carrot, onion and mushroom; sweet & sour sauce."
    }
  },
  {
    "id": "vegangoldenbag",
    "cat": "starters",
    "price": 65000,
    "emoji": "🍽️",
    "base": "assets/menu/vegangoldenbag",
    "widths": [480, 960],
    "w": 960,
    "h": 720,
    "image": "assets/menu/vegangoldenbag-960.webp",
    "tags": [],
    "name": {
      "en": "Vegan golden bag",
      "vi": "Vegan golden bag"
    },
    "desc": {
      "en": "Green bean paper with carrot, mushroom, corn, bean sprout, peanut and soy sauce.",
      "vi": "Green bean paper with carrot, mushroom, corn, bean sprout, peanut and soy sauce."
    }
  },
  {
    "id": "summersalad",
    "cat": "starters",
    "price": 70000,
    "emoji": "🍽️",
    "tags": [],
    "name": {
      "en": "Summer salad",
      "vi": "Summer salad"
    },
    "desc": {
      "en": "Lettuce, mango, carrot, cucumber, bell pepper, cabbage, mint and peanuts.",
      "vi": "Lettuce, mango, carrot, cucumber, bell pepper, cabbage, mint and peanuts."
    }
  },
  {
    "id": "papayasaladwithgrilledto",
    "cat": "starters",
    "price": 70000,
    "emoji": "🍽️",
    "base": "assets/menu/papayasaladwithgrilledto",
    "widths": [480, 960],
    "w": 768,
    "h": 1024,
    "image": "assets/menu/papayasaladwithgrilledto-960.webp",
    "tags": [],
    "name": {
      "en": "Papaya salad with grilled tofu",
      "vi": "Papaya salad with grilled tofu"
    },
    "desc": {
      "en": "Green papaya, carrot, cabbage, mint, grilled tofu and sweet & sour sauce.",
      "vi": "Green papaya, carrot, cabbage, mint, grilled tofu and sweet & sour sauce."
    }
  },
  {
    "id": "freshvegetablesdip",
    "cat": "starters",
    "price": 70000,
    "emoji": "🍽️",
    "base": "assets/menu/freshvegetablesdip",
    "widths": [480, 960],
    "w": 1024,
    "h": 986,
    "image": "assets/menu/freshvegetablesdip-960.webp",
    "tags": [],
    "name": {
      "en": "Fresh vegetables dip",
      "vi": "Fresh vegetables dip"
    },
    "desc": {
      "en": "Carrot, cherry tomato, cucumber, cauliflower and green bean with tahini and hummus.",
      "vi": "Carrot, cherry tomato, cucumber, cauliflower and green bean with tahini and hummus."
    }
  },
  {
    "id": "avocadosalad",
    "cat": "starters",
    "price": 80000,
    "emoji": "🍽️",
    "tags": [],
    "name": {
      "en": "Avocado salad",
      "vi": "Avocado salad"
    },
    "desc": {
      "en": "Mashed avocado, corn, tomato, cucumber, shallot, lime and toast.",
      "vi": "Mashed avocado, corn, tomato, cucumber, shallot, lime and toast."
    }
  },
  {
    "id": "mushroombroccolisoup",
    "cat": "starters",
    "price": 60000,
    "emoji": "🍲",
    "tags": [],
    "name": {
      "en": "Mushroom & broccoli soup",
      "vi": "Mushroom & broccoli soup"
    },
    "desc": {
      "en": "Broccoli, mushroom and onion with soy milk; served with toast.",
      "vi": "Broccoli, mushroom and onion with soy milk; served with toast."
    }
  },
  {
    "id": "pumpkinsoup",
    "cat": "starters",
    "price": 60000,
    "emoji": "🍲",
    "base": "assets/menu/pumpkinsoup",
    "widths": [480, 960],
    "w": 825,
    "h": 1024,
    "image": "assets/menu/pumpkinsoup-960.webp",
    "tags": [],
    "name": {
      "en": "Pumpkin soup",
      "vi": "Pumpkin soup"
    },
    "desc": {
      "en": "Pumpkin, onion and carrot with coconut cream; served with toast.",
      "vi": "Pumpkin, onion and carrot with coconut cream; served with toast."
    }
  },
  {
    "id": "zoodleswithavopesto",
    "cat": "mains",
    "price": 80000,
    "emoji": "🍽️",
    "base": "assets/menu/zoodleswithavopesto",
    "widths": [480, 960],
    "w": 769,
    "h": 1024,
    "image": "assets/menu/zoodleswithavopesto-960.webp",
    "tags": [],
    "name": {
      "en": "Zoodles with avo pesto",
      "vi": "Zoodles with avo pesto"
    },
    "desc": {
      "en": "Zucchini noodles with avocado, basil, cashew sauce and cherry tomatoes.",
      "vi": "Zucchini noodles with avocado, basil, cashew sauce and cherry tomatoes."
    }
  },
  {
    "id": "zoodleswithtomatosauce",
    "cat": "mains",
    "price": 80000,
    "emoji": "🍽️",
    "tags": [],
    "name": {
      "en": "Zoodles with tomato sauce",
      "vi": "Zoodles with tomato sauce"
    },
    "desc": {
      "en": "Zucchini noodles with onion, capsicum and house tomato sauce.",
      "vi": "Zucchini noodles with onion, capsicum and house tomato sauce."
    }
  },
  {
    "id": "pumpkingnocchi",
    "cat": "mains",
    "price": 85000,
    "emoji": "🍽️",
    "tags": [],
    "name": {
      "en": "Pumpkin gnocchi",
      "vi": "Pumpkin gnocchi"
    },
    "desc": {
      "en": "Housemade pumpkin gnocchi with spinach, mushroom, cherry tomatoes and basil pesto.",
      "vi": "Housemade pumpkin gnocchi with spinach, mushroom, cherry tomatoes and basil pesto."
    }
  },
  {
    "id": "hamcheeseburger",
    "cat": "mains",
    "price": 110000,
    "emoji": "🍔",
    "tags": [],
    "name": {
      "en": "Ham & cheese burger",
      "vi": "Ham & cheese burger"
    },
    "desc": {
      "en": "Vegan ham and cheese burger with sweet potato fries.",
      "vi": "Vegan ham and cheese burger with sweet potato fries."
    }
  },
  {
    "id": "veganburger",
    "cat": "mains",
    "price": 120000,
    "emoji": "🍔",
    "base": "assets/menu/veganburger",
    "widths": [480, 960],
    "w": 1024,
    "h": 576,
    "image": "assets/menu/veganburger-960.webp",
    "tags": [],
    "name": {
      "en": "Vegan burger",
      "vi": "Vegan burger"
    },
    "desc": {
      "en": "Chickpea and black bean patty with sweet potato fries.",
      "vi": "Chickpea and black bean patty with sweet potato fries."
    }
  },
  {
    "id": "vegansandwich",
    "cat": "mains",
    "price": 110000,
    "emoji": "🥪",
    "base": "assets/menu/vegansandwich",
    "widths": [480, 960],
    "w": 720,
    "h": 960,
    "image": "assets/menu/vegansandwich-960.webp",
    "tags": [],
    "name": {
      "en": "Vegan sandwich",
      "vi": "Vegan sandwich"
    },
    "desc": {
      "en": "Chickpea and corn patty sandwich with sweet potato fries.",
      "vi": "Chickpea and corn patty sandwich with sweet potato fries."
    }
  },
  {
    "id": "hamcheesesandwich",
    "cat": "mains",
    "price": 110000,
    "emoji": "🥪",
    "tags": [],
    "name": {
      "en": "Ham & cheese sandwich",
      "vi": "Ham & cheese sandwich"
    },
    "desc": {
      "en": "Vegan ham and cheese sandwich with sweet potato fries.",
      "vi": "Vegan ham and cheese sandwich with sweet potato fries."
    }
  },
  {
    "id": "tofuchips",
    "cat": "mains",
    "price": 80000,
    "emoji": "🍽️",
    "base": "assets/menu/tofuchips",
    "widths": [480, 960],
    "w": 768,
    "h": 1024,
    "image": "assets/menu/tofuchips-960.webp",
    "tags": [],
    "name": {
      "en": "Tofu & chips",
      "vi": "Tofu & chips"
    },
    "desc": {
      "en": "Deep fried tofu and fries with coleslaw, chutney and tartar sauce.",
      "vi": "Deep fried tofu and fries with coleslaw, chutney and tartar sauce."
    }
  },
  {
    "id": "crispymushroom",
    "cat": "mains",
    "price": 70000,
    "emoji": "🍽️",
    "base": "assets/menu/crispymushroom",
    "widths": [480, 960],
    "w": 766,
    "h": 1024,
    "image": "assets/menu/crispymushroom-960.webp",
    "tags": [],
    "name": {
      "en": "Crispy mushroom",
      "vi": "Crispy mushroom"
    },
    "desc": {
      "en": "Deep fried mushroom with coleslaw, chilli sauce and vegan mayo.",
      "vi": "Deep fried mushroom with coleslaw, chilli sauce and vegan mayo."
    }
  },
  {
    "id": "zucchinifritters",
    "cat": "mains",
    "price": 80000,
    "emoji": "🍽️",
    "tags": [],
    "name": {
      "en": "Zucchini fritters",
      "vi": "Zucchini fritters"
    },
    "desc": {
      "en": "Zucchini and carrot patty with tomato chutney and tartar sauce.",
      "vi": "Zucchini and carrot patty with tomato chutney and tartar sauce."
    }
  },
  {
    "id": "noodleswithvegetables",
    "cat": "mains",
    "price": 85000,
    "emoji": "🍽️",
    "base": "assets/menu/noodleswithvegetables",
    "widths": [480, 960],
    "w": 1024,
    "h": 771,
    "image": "assets/menu/noodleswithvegetables-960.webp",
    "tags": [],
    "name": {
      "en": "Noodles with vegetables",
      "vi": "Noodles with vegetables"
    },
    "desc": {
      "en": "Rice noodles with carrot, mushroom, bell pepper, onion and bok choy.",
      "vi": "Rice noodles with carrot, mushroom, bell pepper, onion and bok choy."
    }
  },
  {
    "id": "noodleswithfalafeltofu",
    "cat": "mains",
    "price": 90000,
    "emoji": "🍽️",
    "base": "assets/menu/noodleswithfalafeltofu",
    "widths": [480, 960],
    "w": 763,
    "h": 1024,
    "image": "assets/menu/noodleswithfalafeltofu-960.webp",
    "tags": [],
    "name": {
      "en": "Noodles with falafel & tofu",
      "vi": "Noodles with falafel & tofu"
    },
    "desc": {
      "en": "Rice noodles with vegetables, falafel, fried spring rolls and tofu.",
      "vi": "Rice noodles with vegetables, falafel, fried spring rolls and tofu."
    }
  },
  {
    "id": "greencurry",
    "cat": "mains",
    "price": 95000,
    "emoji": "🍛",
    "tags": [],
    "name": {
      "en": "Green curry",
      "vi": "Green curry"
    },
    "desc": {
      "en": "Green bean, tofu, carrot, baby corn, zucchini, mushroom and broccoli with rice and salad.",
      "vi": "Green bean, tofu, carrot, baby corn, zucchini, mushroom and broccoli with rice and salad."
    }
  },
  {
    "id": "stirfriedpastawithvegeta",
    "cat": "mains",
    "price": 100000,
    "emoji": "🍽️",
    "tags": [],
    "name": {
      "en": "Stir-fried pasta with vegetables & tofu",
      "vi": "Stir-fried pasta with vegetables & tofu"
    },
    "desc": {
      "en": "Brown pasta with carrot, onion, capsicum, broccoli, mushroom and bok choy.",
      "vi": "Brown pasta with carrot, onion, capsicum, broccoli, mushroom and bok choy."
    }
  },
  {
    "id": "redcurry",
    "cat": "mains",
    "price": 100000,
    "emoji": "🍛",
    "tags": [],
    "name": {
      "en": "Red curry",
      "vi": "Red curry"
    },
    "desc": {
      "en": "Mushroom, green bean, tofu, carrot, capsicum, zucchini and eggplant with rice and salad.",
      "vi": "Mushroom, green bean, tofu, carrot, capsicum, zucchini and eggplant with rice and salad."
    }
  },
  {
    "id": "potatocarrotcurry",
    "cat": "mains",
    "price": 100000,
    "emoji": "🍛",
    "tags": [],
    "name": {
      "en": "Potato & carrot curry",
      "vi": "Potato & carrot curry"
    },
    "desc": {
      "en": "Potato, carrot, mushroom and onion with brown rice and salad.",
      "vi": "Potato, carrot, mushroom and onion with brown rice and salad."
    }
  },
  {
    "id": "falafelwithfreshsalad",
    "cat": "mains",
    "price": 90000,
    "emoji": "🍽️",
    "tags": [],
    "name": {
      "en": "Falafel with fresh salad",
      "vi": "Falafel with fresh salad"
    },
    "desc": {
      "en": "Falafel patties with salad greens and tahini.",
      "vi": "Falafel patties with salad greens and tahini."
    }
  },
  {
    "id": "mushroomandtofupatties",
    "cat": "mains",
    "price": 80000,
    "emoji": "🍽️",
    "base": "assets/menu/mushroomandtofupatties",
    "widths": [480, 960],
    "w": 768,
    "h": 1024,
    "image": "assets/menu/mushroomandtofupatties-960.webp",
    "tags": [],
    "name": {
      "en": "Mushroom and tofu patties",
      "vi": "Mushroom and tofu patties"
    },
    "desc": {
      "en": "Pan-fried mushroom and tofu patties with brown bread and salad.",
      "vi": "Pan-fried mushroom and tofu patties with brown bread and salad."
    }
  },
  {
    "id": "falafelbowl",
    "cat": "mains",
    "price": 100000,
    "emoji": "🍽️",
    "base": "assets/menu/falafelbowl",
    "widths": [480, 960],
    "w": 768,
    "h": 1024,
    "image": "assets/menu/falafelbowl-960.webp",
    "tags": [],
    "name": {
      "en": "Falafel bowl",
      "vi": "Falafel bowl"
    },
    "desc": {
      "en": "Falafel with tomato, salad, corn, hummus, tofu and tahini dressing.",
      "vi": "Falafel with tomato, salad, corn, hummus, tofu and tahini dressing."
    }
  },
  {
    "id": "specialbowl",
    "cat": "mains",
    "price": 110000,
    "emoji": "🍽️",
    "base": "assets/menu/specialbowl",
    "widths": [480, 960],
    "w": 757,
    "h": 1024,
    "image": "assets/menu/specialbowl-960.webp",
    "tags": [],
    "name": {
      "en": "Special bowl",
      "vi": "Special bowl"
    },
    "desc": {
      "en": "Brown rice with avocado, red cabbage, corn, red bean, sweet potato, mushroom and tortillas.",
      "vi": "Brown rice with avocado, red cabbage, corn, red bean, sweet potato, mushroom and tortillas."
    }
  },
  {
    "id": "mexicanwrap",
    "cat": "mains",
    "price": 120000,
    "emoji": "🍽️",
    "base": "assets/menu/mexicanwrap",
    "widths": [480, 960],
    "w": 768,
    "h": 1024,
    "image": "assets/menu/mexicanwrap-960.webp",
    "tags": [],
    "name": {
      "en": "Mexican wrap",
      "vi": "Mexican wrap"
    },
    "desc": {
      "en": "Black beans, rice, corn, peppers, tomato and lime in tortillas with sides.",
      "vi": "Black beans, rice, corn, peppers, tomato and lime in tortillas with sides."
    }
  },
  {
    "id": "tofutomato",
    "cat": "mains",
    "price": 95000,
    "emoji": "🍽️",
    "tags": [],
    "name": {
      "en": "Tofu & tomato",
      "vi": "Tofu & tomato"
    },
    "desc": {
      "en": "Fried tofu in tomato sauce with brown rice and salad.",
      "vi": "Fried tofu in tomato sauce with brown rice and salad."
    }
  },
  {
    "id": "friedbrownricewithvegeta",
    "cat": "mains",
    "price": 85000,
    "emoji": "🍚",
    "tags": [],
    "name": {
      "en": "Fried brown rice with vegetables",
      "vi": "Fried brown rice with vegetables"
    },
    "desc": {
      "en": "Fried brown rice with carrot, green bean, corn, onion and zucchini.",
      "vi": "Fried brown rice with carrot, green bean, corn, onion and zucchini."
    }
  },
  {
    "id": "friedbrownricewithpineap",
    "cat": "mains",
    "price": 85000,
    "emoji": "🍚",
    "tags": [],
    "name": {
      "en": "Fried brown rice with pineapple",
      "vi": "Fried brown rice with pineapple"
    },
    "desc": {
      "en": "Fried brown rice with onion, capsicum, pineapple and spring onion.",
      "vi": "Fried brown rice with onion, capsicum, pineapple and spring onion."
    }
  },
  {
    "id": "veganbibimbap",
    "cat": "mains",
    "price": 95000,
    "emoji": "🍽️",
    "base": "assets/menu/veganbibimbap",
    "widths": [480, 960],
    "w": 500,
    "h": 667,
    "image": "assets/menu/veganbibimbap-960.webp",
    "tags": [],
    "name": {
      "en": "Vegan bibimbap",
      "vi": "Vegan bibimbap"
    },
    "desc": {
      "en": "Tofu, spinach, carrot, mushroom, zucchini, bean sprout and brown rice.",
      "vi": "Tofu, spinach, carrot, mushroom, zucchini, bean sprout and brown rice."
    }
  },
  {
    "id": "morningglorywithmushroom",
    "cat": "mains",
    "price": 65000,
    "emoji": "🍽️",
    "base": "assets/menu/morningglorywithmushroom",
    "widths": [480, 960],
    "w": 960,
    "h": 720,
    "image": "assets/menu/morningglorywithmushroom-960.webp",
    "tags": [],
    "name": {
      "en": "Morning glory with mushroom",
      "vi": "Morning glory with mushroom"
    },
    "desc": {
      "en": "Sautéed morning glory with mushroom and garlic.",
      "vi": "Sautéed morning glory with mushroom and garlic."
    }
  },
  {
    "id": "eggplantheaven",
    "cat": "mains",
    "price": 80000,
    "emoji": "🍽️",
    "tags": [],
    "name": {
      "en": "Eggplant heaven",
      "vi": "Eggplant heaven"
    },
    "desc": {
      "en": "Eggplant with potatoes and onion in tomato gravy with brown rice.",
      "vi": "Eggplant with potatoes and onion in tomato gravy with brown rice."
    }
  },
  {
    "id": "braisedeggplantinclaypot",
    "cat": "mains",
    "price": 80000,
    "emoji": "🍽️",
    "tags": [],
    "name": {
      "en": "Braised eggplant in clay pot",
      "vi": "Braised eggplant in clay pot"
    },
    "desc": {
      "en": "Eggplant, onion and celery in soy sauce with brown rice.",
      "vi": "Eggplant, onion and celery in soy sauce with brown rice."
    }
  },
  {
    "id": "braisedtofuandmushroomin",
    "cat": "mains",
    "price": 90000,
    "emoji": "🍽️",
    "base": "assets/menu/braisedtofuandmushroomin",
    "widths": [480, 960],
    "w": 768,
    "h": 1024,
    "image": "assets/menu/braisedtofuandmushroomin-960.webp",
    "tags": [],
    "name": {
      "en": "Braised tofu and mushroom in clay pot",
      "vi": "Braised tofu and mushroom in clay pot"
    },
    "desc": {
      "en": "Tofu, mushroom, carrot, ginger and chilli with brown rice.",
      "vi": "Tofu, mushroom, carrot, ginger and chilli with brown rice."
    }
  },
  {
    "id": "fivespicetofu",
    "cat": "mains",
    "price": 90000,
    "emoji": "🍽️",
    "tags": [],
    "name": {
      "en": "Five-spice tofu",
      "vi": "Five-spice tofu"
    },
    "desc": {
      "en": "Sautéed tofu with capsicum, cucumber, tomato and shallot; fries and salad.",
      "vi": "Sautéed tofu with capsicum, cucumber, tomato and shallot; fries and salad."
    }
  },
  {
    "id": "spinachmushroomgarlicpiz",
    "cat": "pizza-pasta",
    "price": 110000,
    "emoji": "🍕",
    "tags": [],
    "name": {
      "en": "Spinach mushroom & garlic pizza",
      "vi": "Spinach mushroom & garlic pizza"
    },
    "desc": {
      "en": "Housemade vegan cheese, tomato, spinach, mushroom and garlic.",
      "vi": "Housemade vegan cheese, tomato, spinach, mushroom and garlic."
    }
  },
  {
    "id": "hamcheesepizza",
    "cat": "pizza-pasta",
    "price": 100000,
    "emoji": "🍕",
    "tags": [],
    "name": {
      "en": "Ham & cheese pizza",
      "vi": "Ham & cheese pizza"
    },
    "desc": {
      "en": "Housemade vegan cheese, tomato, vegan ham and olives.",
      "vi": "Housemade vegan cheese, tomato, vegan ham and olives."
    }
  },
  {
    "id": "tomatopizza",
    "cat": "pizza-pasta",
    "price": 90000,
    "emoji": "🍕",
    "tags": [],
    "name": {
      "en": "Tomato pizza",
      "vi": "Tomato pizza"
    },
    "desc": {
      "en": "Housemade vegan cheese, tomato sauce and basil.",
      "vi": "Housemade vegan cheese, tomato sauce and basil."
    }
  },
  {
    "id": "veganspaghettiwithtomato",
    "cat": "pizza-pasta",
    "price": 90000,
    "emoji": "🍝",
    "base": "assets/menu/veganspaghettiwithtomato",
    "widths": [480, 960],
    "w": 768,
    "h": 1024,
    "image": "assets/menu/veganspaghettiwithtomato-960.webp",
    "tags": [],
    "name": {
      "en": "Vegan spaghetti with tomato sauce",
      "vi": "Vegan spaghetti with tomato sauce"
    },
    "desc": {
      "en": "Spaghetti with onion and fresh tomato sauce.",
      "vi": "Spaghetti with onion and fresh tomato sauce."
    }
  },
  {
    "id": "veganspaghettiwithtofubo",
    "cat": "pizza-pasta",
    "price": 110000,
    "emoji": "🍝",
    "tags": [],
    "name": {
      "en": "Vegan spaghetti with tofu bolognese",
      "vi": "Vegan spaghetti with tofu bolognese"
    },
    "desc": {
      "en": "Spaghetti with fresh tofu, carrot and tomato sauce.",
      "vi": "Spaghetti with fresh tofu, carrot and tomato sauce."
    }
  },
  {
    "id": "veganspaghettiwithmushro",
    "cat": "pizza-pasta",
    "price": 100000,
    "emoji": "🍝",
    "tags": [],
    "name": {
      "en": "Vegan spaghetti with mushroom cream",
      "vi": "Vegan spaghetti with mushroom cream"
    },
    "desc": {
      "en": "Spaghetti with mushroom and soy cream.",
      "vi": "Spaghetti with mushroom and soy cream."
    }
  },
  {
    "id": "veganpastawithtomatosauc",
    "cat": "pizza-pasta",
    "price": 90000,
    "emoji": "🍝",
    "tags": [],
    "name": {
      "en": "Vegan pasta with tomato sauce",
      "vi": "Vegan pasta with tomato sauce"
    },
    "desc": {
      "en": "Brown pasta with tomato sauce, parsley and vegan cheese.",
      "vi": "Brown pasta with tomato sauce, parsley and vegan cheese."
    }
  },
  {
    "id": "veganpastawithtofubologn",
    "cat": "pizza-pasta",
    "price": 110000,
    "emoji": "🍝",
    "tags": [],
    "name": {
      "en": "Vegan pasta with tofu bolognese",
      "vi": "Vegan pasta with tofu bolognese"
    },
    "desc": {
      "en": "Brown pasta with tofu bolognese.",
      "vi": "Brown pasta with tofu bolognese."
    }
  },
  {
    "id": "veganspaghetticarbonara",
    "cat": "pizza-pasta",
    "price": 110000,
    "emoji": "🍝",
    "tags": [],
    "name": {
      "en": "Vegan spaghetti carbonara",
      "vi": "Vegan spaghetti carbonara"
    },
    "desc": {
      "en": "Spaghetti with vegan ham, onion and soy cream.",
      "vi": "Spaghetti with vegan ham, onion and soy cream."
    }
  },
  {
    "id": "icecream",
    "cat": "desserts",
    "price": 50000,
    "emoji": "🍨",
    "tags": [],
    "name": {
      "en": "Ice cream",
      "vi": "Ice cream"
    },
    "desc": {
      "en": "Mango, strawberry, coconut, avocado or chocolate.",
      "vi": "Mango, strawberry, coconut, avocado or chocolate."
    }
  },
  {
    "id": "bananafritterswithchocol",
    "cat": "desserts",
    "price": 50000,
    "emoji": "🍌",
    "tags": [],
    "name": {
      "en": "Banana fritters with chocolate mousse",
      "vi": "Banana fritters with chocolate mousse"
    },
    "desc": {
      "en": "Banana fritters with vegan chocolate mousse.",
      "vi": "Banana fritters with vegan chocolate mousse."
    }
  },
  {
    "id": "veganyogurtwithfreshfrui",
    "cat": "desserts",
    "price": 50000,
    "emoji": "🥣",
    "tags": [],
    "name": {
      "en": "Vegan yogurt with fresh fruit",
      "vi": "Vegan yogurt with fresh fruit"
    },
    "desc": {
      "en": "House coconut yogurt with seasonal fruit.",
      "vi": "House coconut yogurt with seasonal fruit."
    }
  },
  {
    "id": "veganchocolatemousse",
    "cat": "desserts",
    "price": 50000,
    "emoji": "🍫",
    "tags": [],
    "name": {
      "en": "Vegan chocolate mousse",
      "vi": "Vegan chocolate mousse"
    },
    "desc": {
      "en": "Rich vegan chocolate mousse.",
      "vi": "Rich vegan chocolate mousse."
    }
  },
  {
    "id": "freshfruits",
    "cat": "desserts",
    "price": 60000,
    "emoji": "🍉",
    "tags": [],
    "name": {
      "en": "Fresh fruits",
      "vi": "Fresh fruits"
    },
    "desc": {
      "en": "Seasonal fresh fruit plate.",
      "vi": "Seasonal fresh fruit plate."
    }
  },
  {
    "id": "chocococosmoothie",
    "cat": "smoothies",
    "price": 60000,
    "emoji": "🥤",
    "tags": [],
    "name": {
      "en": "Choco coco smoothie",
      "vi": "Choco coco smoothie"
    },
    "desc": {
      "en": "Coconut milk, banana, cacao, avocado and mint.",
      "vi": "Coconut milk, banana, cacao, avocado and mint."
    }
  },
  {
    "id": "happybellysmoothie",
    "cat": "smoothies",
    "price": 60000,
    "emoji": "🥤",
    "tags": [],
    "name": {
      "en": "Happy belly smoothie",
      "vi": "Happy belly smoothie"
    },
    "desc": {
      "en": "Banana, pineapple, coconut water and ginger.",
      "vi": "Banana, pineapple, coconut water and ginger."
    }
  },
  {
    "id": "sweetbutpassionatesmooth",
    "cat": "smoothies",
    "price": 60000,
    "emoji": "🥤",
    "tags": [],
    "name": {
      "en": "Sweet but passionate smoothie",
      "vi": "Sweet but passionate smoothie"
    },
    "desc": {
      "en": "Coconut milk, banana, peanut butter, lime and passion fruit.",
      "vi": "Coconut milk, banana, peanut butter, lime and passion fruit."
    }
  },
  {
    "id": "goldenbabesmoothie",
    "cat": "smoothies",
    "price": 60000,
    "emoji": "🥤",
    "tags": [],
    "name": {
      "en": "Golden babe smoothie",
      "vi": "Golden babe smoothie"
    },
    "desc": {
      "en": "Turmeric, mango, coconut water and lime.",
      "vi": "Turmeric, mango, coconut water and lime."
    }
  },
  {
    "id": "greenmonstersmoothie",
    "cat": "smoothies",
    "price": 60000,
    "emoji": "🥤",
    "tags": [],
    "name": {
      "en": "Green monster smoothie",
      "vi": "Green monster smoothie"
    },
    "desc": {
      "en": "Celery, cucumber, pineapple, apple and coconut water.",
      "vi": "Celery, cucumber, pineapple, apple and coconut water."
    }
  },
  {
    "id": "sotropicalsmoothie",
    "cat": "smoothies",
    "price": 60000,
    "emoji": "🥤",
    "tags": [],
    "name": {
      "en": "So tropical smoothie",
      "vi": "So tropical smoothie"
    },
    "desc": {
      "en": "Watermelon, strawberry, mango, passion fruit, mint and ginger.",
      "vi": "Watermelon, strawberry, mango, passion fruit, mint and ginger."
    }
  },
  {
    "id": "ohmycoconutsmoothie",
    "cat": "smoothies",
    "price": 60000,
    "emoji": "🥤",
    "tags": [],
    "name": {
      "en": "Oh my coconut smoothie",
      "vi": "Oh my coconut smoothie"
    },
    "desc": {
      "en": "Coconut water, coconut meat, coconut sugar and sea salt.",
      "vi": "Coconut water, coconut meat, coconut sugar and sea salt."
    }
  },
  {
    "id": "redlovejuiceblend",
    "cat": "smoothies",
    "price": 65000,
    "emoji": "🧃",
    "tags": [],
    "name": {
      "en": "Red Love juice blend",
      "vi": "Red Love juice blend"
    },
    "desc": {
      "en": "Orange, apple and beetroot.",
      "vi": "Orange, apple and beetroot."
    }
  },
  {
    "id": "kickstartyourdayjuiceble",
    "cat": "smoothies",
    "price": 65000,
    "emoji": "🧃",
    "tags": [],
    "name": {
      "en": "Kick start your day juice blend",
      "vi": "Kick start your day juice blend"
    },
    "desc": {
      "en": "Lemon, carrot, apple and beetroot.",
      "vi": "Lemon, carrot, apple and beetroot."
    }
  },
  {
    "id": "ultimategreendetoxjuiceb",
    "cat": "smoothies",
    "price": 65000,
    "emoji": "🧃",
    "tags": [],
    "name": {
      "en": "Ultimate green detox juice blend",
      "vi": "Ultimate green detox juice blend"
    },
    "desc": {
      "en": "Morning glory, lettuce, celery, apple, cucumber and lime.",
      "vi": "Morning glory, lettuce, celery, apple, cucumber and lime."
    }
  },
  {
    "id": "passionjuiceblend",
    "cat": "smoothies",
    "price": 65000,
    "emoji": "🧃",
    "tags": [],
    "name": {
      "en": "Passion juice blend",
      "vi": "Passion juice blend"
    },
    "desc": {
      "en": "Passion fruit, watermelon, lime and mint.",
      "vi": "Passion fruit, watermelon, lime and mint."
    }
  },
  {
    "id": "vitamincjuiceblend",
    "cat": "smoothies",
    "price": 65000,
    "emoji": "🧃",
    "tags": [],
    "name": {
      "en": "Vitamin C juice blend",
      "vi": "Vitamin C juice blend"
    },
    "desc": {
      "en": "Guava, cucumber, apple, lime and mint.",
      "vi": "Guava, cucumber, apple, lime and mint."
    }
  },
  {
    "id": "magichangovercurejuicebl",
    "cat": "smoothies",
    "price": 65000,
    "emoji": "🧃",
    "tags": [],
    "name": {
      "en": "Magic hangover cure juice blend",
      "vi": "Magic hangover cure juice blend"
    },
    "desc": {
      "en": "Coconut water with pineapple.",
      "vi": "Coconut water with pineapple."
    }
  },
  {
    "id": "spiceitupjuiceblend",
    "cat": "smoothies",
    "price": 65000,
    "emoji": "🧃",
    "tags": [],
    "name": {
      "en": "Spice it up juice blend",
      "vi": "Spice it up juice blend"
    },
    "desc": {
      "en": "Carrot, ginger, pineapple and chilli.",
      "vi": "Carrot, ginger, pineapple and chilli."
    }
  },
  {
    "id": "fishermancolour",
    "cat": "cocktails",
    "price": 97000,
    "emoji": "🍹",
    "tags": [],
    "name": {
      "en": "Fisherman Colour",
      "vi": "Fisherman Colour"
    },
    "desc": {
      "en": "Rum, midori, passion fruit, sugar syrup and lime.",
      "vi": "Rum, midori, passion fruit, sugar syrup and lime."
    }
  },
  {
    "id": "pimmscup",
    "cat": "cocktails",
    "price": 97000,
    "emoji": "🍹",
    "tags": [],
    "name": {
      "en": "Pimm's Cup",
      "vi": "Pimm's Cup"
    },
    "desc": {
      "en": "Dark rum, passion fruit, peach liqueur and sugar.",
      "vi": "Dark rum, passion fruit, peach liqueur and sugar."
    }
  },
  {
    "id": "jacksmash",
    "cat": "cocktails",
    "price": 97000,
    "emoji": "🍹",
    "tags": [],
    "name": {
      "en": "Jack smash",
      "vi": "Jack smash"
    },
    "desc": {
      "en": "Whiskey, mint, lime, sugar syrup and angostura.",
      "vi": "Whiskey, mint, lime, sugar syrup and angostura."
    }
  },
  {
    "id": "bluehighball",
    "cat": "cocktails",
    "price": 97000,
    "emoji": "🍹",
    "tags": [],
    "name": {
      "en": "Blue Highball",
      "vi": "Blue Highball"
    },
    "desc": {
      "en": "Cachaça, blue curacao, vanilla, pineapple and lime.",
      "vi": "Cachaça, blue curacao, vanilla, pineapple and lime."
    }
  },
  {
    "id": "summertime",
    "cat": "cocktails",
    "price": 97000,
    "emoji": "🍹",
    "tags": [],
    "name": {
      "en": "Summer Time",
      "vi": "Summer Time"
    },
    "desc": {
      "en": "Gin, strawberry, lime and sugar syrup.",
      "vi": "Gin, strawberry, lime and sugar syrup."
    }
  },
  {
    "id": "trymebaby",
    "cat": "cocktails",
    "price": 97000,
    "emoji": "🍹",
    "tags": [],
    "name": {
      "en": "Try me baby",
      "vi": "Try me baby"
    },
    "desc": {
      "en": "Gin, cucumber juice, cucumber syrup, lime and soda.",
      "vi": "Gin, cucumber juice, cucumber syrup, lime and soda."
    }
  },
  {
    "id": "daiquiri",
    "cat": "cocktails",
    "price": 85000,
    "emoji": "🍸",
    "tags": [],
    "name": {
      "en": "Daiquiri",
      "vi": "Daiquiri"
    },
    "desc": {
      "en": "Rum, lime and sugar syrup (optional strawberry or mango).",
      "vi": "Rum, lime and sugar syrup (optional strawberry or mango)."
    }
  },
  {
    "id": "mojito",
    "cat": "cocktails",
    "price": 85000,
    "emoji": "🍸",
    "tags": [],
    "name": {
      "en": "Mojito",
      "vi": "Mojito"
    },
    "desc": {
      "en": "Rum, mint, lime, sugar and soda (optional beetroot or passion fruit).",
      "vi": "Rum, mint, lime, sugar and soda (optional beetroot or passion fruit)."
    }
  },
  {
    "id": "longislandicetea",
    "cat": "cocktails",
    "price": 85000,
    "emoji": "🍸",
    "tags": [],
    "name": {
      "en": "Long island ice tea",
      "vi": "Long island ice tea"
    },
    "desc": {
      "en": "Gin, vodka, rum, tequila, Cointreau, lime, sugar and coke.",
      "vi": "Gin, vodka, rum, tequila, Cointreau, lime, sugar and coke."
    }
  },
  {
    "id": "margarita",
    "cat": "cocktails",
    "price": 85000,
    "emoji": "🍸",
    "tags": [],
    "name": {
      "en": "Margarita",
      "vi": "Margarita"
    },
    "desc": {
      "en": "Tequila, Cointreau, lime and sugar syrup.",
      "vi": "Tequila, Cointreau, lime and sugar syrup."
    }
  },
  {
    "id": "passionfruitmartini",
    "cat": "cocktails",
    "price": 85000,
    "emoji": "🍸",
    "tags": [],
    "name": {
      "en": "Passion fruit martini",
      "vi": "Passion fruit martini"
    },
    "desc": {
      "en": "Vodka, passion fruit juice and sugar syrup.",
      "vi": "Vodka, passion fruit juice and sugar syrup."
    }
  },
  {
    "id": "chocolatemartini",
    "cat": "cocktails",
    "price": 85000,
    "emoji": "🍸",
    "tags": [],
    "name": {
      "en": "Chocolate martini",
      "vi": "Chocolate martini"
    },
    "desc": {
      "en": "Vodka, Baileys and chocolate syrup.",
      "vi": "Vodka, Baileys and chocolate syrup."
    }
  },
  {
    "id": "caipirinha",
    "cat": "cocktails",
    "price": 85000,
    "emoji": "🍸",
    "tags": [],
    "name": {
      "en": "Caipirinha",
      "vi": "Caipirinha"
    },
    "desc": {
      "en": "Cachaça, lime wedges and brown sugar.",
      "vi": "Cachaça, lime wedges and brown sugar."
    }
  },
  {
    "id": "pinacolada",
    "cat": "cocktails",
    "price": 85000,
    "emoji": "🍹",
    "tags": [],
    "name": {
      "en": "Piña colada",
      "vi": "Piña colada"
    },
    "desc": {
      "en": "Light rum, Malibu, coconut cream and pineapple juice.",
      "vi": "Light rum, Malibu, coconut cream and pineapple juice."
    }
  },
  {
    "id": "singaporesling",
    "cat": "cocktails",
    "price": 85000,
    "emoji": "🍹",
    "tags": [],
    "name": {
      "en": "Singapore sling",
      "vi": "Singapore sling"
    },
    "desc": {
      "en": "Gin, cherry brandy, pineapple juice and grenadine.",
      "vi": "Gin, cherry brandy, pineapple juice and grenadine."
    }
  },
  {
    "id": "oldfashioned",
    "cat": "cocktails",
    "price": 85000,
    "emoji": "🍹",
    "tags": [],
    "name": {
      "en": "Old fashioned",
      "vi": "Old fashioned"
    },
    "desc": {
      "en": "Whisky, sugar cube, angostura and soda water.",
      "vi": "Whisky, sugar cube, angostura and soda water."
    }
  },
  {
    "id": "maitai",
    "cat": "cocktails",
    "price": 85000,
    "emoji": "🍹",
    "tags": [],
    "name": {
      "en": "Mai Tai",
      "vi": "Mai Tai"
    },
    "desc": {
      "en": "Light and dark rum, pineapple, orange juice, amaretto and grenadine.",
      "vi": "Light and dark rum, pineapple, orange juice, amaretto and grenadine."
    }
  },
  {
    "id": "luckysunshinemocktail",
    "cat": "cocktails",
    "price": 69000,
    "emoji": "🥤",
    "tags": [],
    "name": {
      "en": "Lucky Sunshine mocktail",
      "vi": "Lucky Sunshine mocktail"
    },
    "desc": {
      "en": "Strawberry, mint, lime, sprite and grenadine.",
      "vi": "Strawberry, mint, lime, sprite and grenadine."
    }
  },
  {
    "id": "virginpinacolada",
    "cat": "cocktails",
    "price": 69000,
    "emoji": "🥤",
    "tags": [],
    "name": {
      "en": "Virgin piña colada",
      "vi": "Virgin piña colada"
    },
    "desc": {
      "en": "Pineapple juice, coconut syrup and coconut cream.",
      "vi": "Pineapple juice, coconut syrup and coconut cream."
    }
  },
  {
    "id": "virginmojito",
    "cat": "cocktails",
    "price": 69000,
    "emoji": "🥤",
    "tags": [],
    "name": {
      "en": "Virgin mojito",
      "vi": "Virgin mojito"
    },
    "desc": {
      "en": "Mint, lime, brown sugar and soda.",
      "vi": "Mint, lime, brown sugar and soda."
    }
  },
  {
    "id": "anbangbeachmocktail",
    "cat": "cocktails",
    "price": 69000,
    "emoji": "🥤",
    "tags": [],
    "name": {
      "en": "An Bang beach mocktail",
      "vi": "An Bang beach mocktail"
    },
    "desc": {
      "en": "Passion fruit, pineapple, mint and vanilla syrup.",
      "vi": "Passion fruit, pineapple, mint and vanilla syrup."
    }
  },
  {
    "id": "shirleytemplemocktail",
    "cat": "cocktails",
    "price": 69000,
    "emoji": "🥤",
    "tags": [],
    "name": {
      "en": "Shirley Temple mocktail",
      "vi": "Shirley Temple mocktail"
    },
    "desc": {
      "en": "Sprite, lime juice and grenadine.",
      "vi": "Sprite, lime juice and grenadine."
    }
  },
  {
    "id": "spiritmixed",
    "cat": "cocktails",
    "price": 70000,
    "emoji": "🥃",
    "tags": [],
    "name": {
      "en": "Spirit & mixed",
      "vi": "Spirit & mixed"
    },
    "desc": {
      "en": "Whisky, gin, vodka, tequila or liquor — mixed drink.",
      "vi": "Whisky, gin, vodka, tequila or liquor — mixed drink."
    }
  },
  {
    "id": "vietnamesecoffee",
    "cat": "drinks",
    "price": 35000,
    "emoji": "☕",
    "tags": [],
    "name": {
      "en": "Vietnamese coffee",
      "vi": "Vietnamese coffee"
    },
    "desc": {
      "en": "Classic Vietnamese coffee.",
      "vi": "Classic Vietnamese coffee."
    }
  },
  {
    "id": "coconutcoffee",
    "cat": "drinks",
    "price": 45000,
    "emoji": "☕",
    "tags": [],
    "name": {
      "en": "Coconut coffee",
      "vi": "Coconut coffee"
    },
    "desc": {
      "en": "Coffee with coconut.",
      "vi": "Coffee with coconut."
    }
  },
  {
    "id": "hotchocolate",
    "cat": "drinks",
    "price": 40000,
    "emoji": "☕",
    "tags": [],
    "name": {
      "en": "Hot chocolate",
      "vi": "Hot chocolate"
    },
    "desc": {
      "en": "Hot chocolate.",
      "vi": "Hot chocolate."
    }
  },
  {
    "id": "tea",
    "cat": "drinks",
    "price": 35000,
    "emoji": "🍵",
    "tags": [],
    "name": {
      "en": "Tea",
      "vi": "Tea"
    },
    "desc": {
      "en": "Green tea, ginger tea or Lipton tea.",
      "vi": "Green tea, ginger tea or Lipton tea."
    }
  },
  {
    "id": "freshcoconut",
    "cat": "drinks",
    "price": 45000,
    "emoji": "🥥",
    "tags": [],
    "name": {
      "en": "Fresh coconut",
      "vi": "Fresh coconut"
    },
    "desc": {
      "en": "Whole fresh coconut.",
      "vi": "Whole fresh coconut."
    }
  },
  {
    "id": "freshwatermelonjuice",
    "cat": "drinks",
    "price": 50000,
    "emoji": "🧃",
    "tags": [],
    "name": {
      "en": "Fresh watermelon juice",
      "vi": "Fresh watermelon juice"
    },
    "desc": {
      "en": "Freshly pressed watermelon juice.",
      "vi": "Freshly pressed watermelon juice."
    }
  },
  {
    "id": "freshpineapplejuice",
    "cat": "drinks",
    "price": 50000,
    "emoji": "🧃",
    "tags": [],
    "name": {
      "en": "Fresh pineapple juice",
      "vi": "Fresh pineapple juice"
    },
    "desc": {
      "en": "Freshly pressed pineapple juice.",
      "vi": "Freshly pressed pineapple juice."
    }
  },
  {
    "id": "freshlemonjuice",
    "cat": "drinks",
    "price": 50000,
    "emoji": "🧃",
    "tags": [],
    "name": {
      "en": "Fresh lemon juice",
      "vi": "Fresh lemon juice"
    },
    "desc": {
      "en": "Freshly pressed lemon juice.",
      "vi": "Freshly pressed lemon juice."
    }
  },
  {
    "id": "freshapplejuice",
    "cat": "drinks",
    "price": 50000,
    "emoji": "🧃",
    "tags": [],
    "name": {
      "en": "Fresh apple juice",
      "vi": "Fresh apple juice"
    },
    "desc": {
      "en": "Freshly pressed apple juice.",
      "vi": "Freshly pressed apple juice."
    }
  },
  {
    "id": "freshcarrotjuice",
    "cat": "drinks",
    "price": 50000,
    "emoji": "🧃",
    "tags": [],
    "name": {
      "en": "Fresh carrot juice",
      "vi": "Fresh carrot juice"
    },
    "desc": {
      "en": "Freshly pressed carrot juice.",
      "vi": "Freshly pressed carrot juice."
    }
  },
  {
    "id": "freshpassionfruitjuice",
    "cat": "drinks",
    "price": 50000,
    "emoji": "🧃",
    "tags": [],
    "name": {
      "en": "Fresh passion fruit juice",
      "vi": "Fresh passion fruit juice"
    },
    "desc": {
      "en": "Freshly pressed passion fruit juice.",
      "vi": "Freshly pressed passion fruit juice."
    }
  },
  {
    "id": "freshbananajuice",
    "cat": "drinks",
    "price": 50000,
    "emoji": "🧃",
    "tags": [],
    "name": {
      "en": "Fresh banana juice",
      "vi": "Fresh banana juice"
    },
    "desc": {
      "en": "Freshly pressed banana juice.",
      "vi": "Freshly pressed banana juice."
    }
  },
  {
    "id": "freshmangojuice",
    "cat": "drinks",
    "price": 50000,
    "emoji": "🧃",
    "tags": [],
    "name": {
      "en": "Fresh mango juice",
      "vi": "Fresh mango juice"
    },
    "desc": {
      "en": "Freshly pressed mango juice.",
      "vi": "Freshly pressed mango juice."
    }
  },
  {
    "id": "freshorangejuice",
    "cat": "drinks",
    "price": 50000,
    "emoji": "🧃",
    "tags": [],
    "name": {
      "en": "Fresh orange juice",
      "vi": "Fresh orange juice"
    },
    "desc": {
      "en": "Freshly pressed orange juice.",
      "vi": "Freshly pressed orange juice."
    }
  },
  {
    "id": "freshbeetrootjuice",
    "cat": "drinks",
    "price": 50000,
    "emoji": "🧃",
    "tags": [],
    "name": {
      "en": "Fresh beetroot juice",
      "vi": "Fresh beetroot juice"
    },
    "desc": {
      "en": "Freshly pressed beetroot juice.",
      "vi": "Freshly pressed beetroot juice."
    }
  },
  {
    "id": "hudabeer",
    "cat": "drinks",
    "price": 25000,
    "emoji": "🍺",
    "tags": [],
    "name": {
      "en": "Huda beer",
      "vi": "Huda beer"
    },
    "desc": {
      "en": "Local beer.",
      "vi": "Local beer."
    }
  },
  {
    "id": "laruebeer",
    "cat": "drinks",
    "price": 25000,
    "emoji": "🍺",
    "tags": [],
    "name": {
      "en": "Larue beer",
      "vi": "Larue beer"
    },
    "desc": {
      "en": "Local beer.",
      "vi": "Local beer."
    }
  },
  {
    "id": "saigonbeer",
    "cat": "drinks",
    "price": 25000,
    "emoji": "🍺",
    "tags": [],
    "name": {
      "en": "Saigon beer",
      "vi": "Saigon beer"
    },
    "desc": {
      "en": "Local beer.",
      "vi": "Local beer."
    }
  },
  {
    "id": "tigerbeer",
    "cat": "drinks",
    "price": 30000,
    "emoji": "🍺",
    "tags": [],
    "name": {
      "en": "Tiger beer",
      "vi": "Tiger beer"
    },
    "desc": {
      "en": "Tiger Blue or Tiger Crystal.",
      "vi": "Tiger Blue or Tiger Crystal."
    }
  },
  {
    "id": "cokecokelight",
    "cat": "drinks",
    "price": 25000,
    "emoji": "🥤",
    "tags": [],
    "name": {
      "en": "Coke / Coke Light",
      "vi": "Coke / Coke Light"
    },
    "desc": {
      "en": "Soft drink.",
      "vi": "Soft drink."
    }
  },
  {
    "id": "fanta",
    "cat": "drinks",
    "price": 25000,
    "emoji": "🥤",
    "tags": [],
    "name": {
      "en": "Fanta",
      "vi": "Fanta"
    },
    "desc": {
      "en": "Soft drink.",
      "vi": "Soft drink."
    }
  },
  {
    "id": "sprite",
    "cat": "drinks",
    "price": 25000,
    "emoji": "🥤",
    "tags": [],
    "name": {
      "en": "Sprite",
      "vi": "Sprite"
    },
    "desc": {
      "en": "Soft drink.",
      "vi": "Soft drink."
    }
  },
  {
    "id": "sodawater",
    "cat": "drinks",
    "price": 25000,
    "emoji": "🥤",
    "tags": [],
    "name": {
      "en": "Soda water",
      "vi": "Soda water"
    },
    "desc": {
      "en": "Sparkling soda water.",
      "vi": "Sparkling soda water."
    }
  },
  {
    "id": "tonicwater",
    "cat": "drinks",
    "price": 25000,
    "emoji": "🥤",
    "tags": [],
    "name": {
      "en": "Tonic water",
      "vi": "Tonic water"
    },
    "desc": {
      "en": "Tonic water.",
      "vi": "Tonic water."
    }
  },
  {
    "id": "smallwater",
    "cat": "drinks",
    "price": 15000,
    "emoji": "💧",
    "tags": [],
    "name": {
      "en": "Small water",
      "vi": "Small water"
    },
    "desc": {
      "en": "Bottled water.",
      "vi": "Bottled water."
    }
  },
  {
    "id": "largewater",
    "cat": "drinks",
    "price": 30000,
    "emoji": "💧",
    "tags": [],
    "name": {
      "en": "Large water",
      "vi": "Large water"
    },
    "desc": {
      "en": "Large bottled water.",
      "vi": "Large bottled water."
    }
  },
  {
    "id": "sparklingwater",
    "cat": "drinks",
    "price": 25000,
    "emoji": "💧",
    "tags": [],
    "name": {
      "en": "Sparkling water",
      "vi": "Sparkling water"
    },
    "desc": {
      "en": "Sparkling mineral water.",
      "vi": "Sparkling mineral water."
    }
  }
];

window.GALLERY = [
  {
    "type": "image",
    "base": "assets/research/all-APNQkAHNeOzs_JI-v2BtTaK7",
    "widths": [
      480,
      960,
      1440
    ],
    "w": 1440,
    "h": 1080,
    "url": "assets/research/all-APNQkAHNeOzs_JI-v2BtTaK7-960.webp",
    "urlFull": "assets/research/all-APNQkAHNeOzs_JI-v2BtTaK7-1440.webp",
    "alt": {
      "en": "All (Google Maps)",
      "vi": "All (Google Maps)"
    }
  },
  {
    "type": "image",
    "base": "assets/research/all-APNQkAEb8I2kREldTOAzUuJQ",
    "widths": [
      480,
      960,
      1440
    ],
    "w": 1440,
    "h": 1080,
    "url": "assets/research/all-APNQkAEb8I2kREldTOAzUuJQ-960.webp",
    "urlFull": "assets/research/all-APNQkAEb8I2kREldTOAzUuJQ-1440.webp",
    "alt": {
      "en": "All (Google Maps)",
      "vi": "All (Google Maps)"
    }
  },
  {
    "type": "image",
    "base": "assets/research/all-APNQkAFIs7pfntC6rI6NXFKY",
    "widths": [
      480,
      960,
      1440
    ],
    "w": 1440,
    "h": 1080,
    "url": "assets/research/all-APNQkAFIs7pfntC6rI6NXFKY-960.webp",
    "urlFull": "assets/research/all-APNQkAFIs7pfntC6rI6NXFKY-1440.webp",
    "alt": {
      "en": "All (Google Maps)",
      "vi": "All (Google Maps)"
    }
  },
  {
    "type": "image",
    "base": "assets/research/all-APNQkAFClECXCf0pv0XUj380",
    "widths": [
      480,
      960,
      1440
    ],
    "w": 1440,
    "h": 1080,
    "url": "assets/research/all-APNQkAFClECXCf0pv0XUj380-960.webp",
    "urlFull": "assets/research/all-APNQkAFClECXCf0pv0XUj380-1440.webp",
    "alt": {
      "en": "All (Google Maps)",
      "vi": "All (Google Maps)"
    }
  },
  {
    "type": "image",
    "base": "assets/research/all-APNQkAEqwRuoWJjdBSrdpiDn",
    "widths": [
      480,
      960,
      1440
    ],
    "w": 1440,
    "h": 1080,
    "url": "assets/research/all-APNQkAEqwRuoWJjdBSrdpiDn-960.webp",
    "urlFull": "assets/research/all-APNQkAEqwRuoWJjdBSrdpiDn-1440.webp",
    "alt": {
      "en": "All (Google Maps)",
      "vi": "All (Google Maps)"
    }
  },
  {
    "type": "image",
    "base": "assets/research/all-APNQkAFSn8O_tlWDoAgPsG0w",
    "widths": [
      480,
      960,
      1440
    ],
    "w": 1440,
    "h": 1080,
    "url": "assets/research/all-APNQkAFSn8O_tlWDoAgPsG0w-960.webp",
    "urlFull": "assets/research/all-APNQkAFSn8O_tlWDoAgPsG0w-1440.webp",
    "alt": {
      "en": "All (Google Maps)",
      "vi": "All (Google Maps)"
    }
  },
  {
    "type": "image",
    "base": "assets/research/all-APNQkAH4vzB1B6UeG2beXOqF",
    "widths": [
      480,
      960,
      1440
    ],
    "w": 1440,
    "h": 1080,
    "url": "assets/research/all-APNQkAH4vzB1B6UeG2beXOqF-960.webp",
    "urlFull": "assets/research/all-APNQkAH4vzB1B6UeG2beXOqF-1440.webp",
    "alt": {
      "en": "All (Google Maps)",
      "vi": "All (Google Maps)"
    }
  },
  {
    "type": "image",
    "base": "assets/research/all-APNQkAGYLfJdA1y09tB2BZef",
    "widths": [
      480,
      960,
      1440
    ],
    "w": 1440,
    "h": 1080,
    "url": "assets/research/all-APNQkAGYLfJdA1y09tB2BZef-960.webp",
    "urlFull": "assets/research/all-APNQkAGYLfJdA1y09tB2BZef-1440.webp",
    "alt": {
      "en": "All (Google Maps)",
      "vi": "All (Google Maps)"
    }
  },
  {
    "type": "image",
    "base": "assets/research/all-APNQkAFQ4g9xTFIOz8xNRU3r",
    "widths": [
      480,
      960,
      1440
    ],
    "w": 1440,
    "h": 1080,
    "url": "assets/research/all-APNQkAFQ4g9xTFIOz8xNRU3r-960.webp",
    "urlFull": "assets/research/all-APNQkAFQ4g9xTFIOz8xNRU3r-1440.webp",
    "alt": {
      "en": "All (Google Maps)",
      "vi": "All (Google Maps)"
    }
  },
  {
    "type": "image",
    "base": "assets/research/all-APNQkAEzfB-3Wp0shQVCSNjP",
    "widths": [
      480,
      960,
      1440
    ],
    "w": 1440,
    "h": 1080,
    "url": "assets/research/all-APNQkAEzfB-3Wp0shQVCSNjP-960.webp",
    "urlFull": "assets/research/all-APNQkAEzfB-3Wp0shQVCSNjP-1440.webp",
    "alt": {
      "en": "All (Google Maps)",
      "vi": "All (Google Maps)"
    }
  },
  {
    "type": "image",
    "base": "assets/research/all-APNQkAFH5nvKwPOs3mVjj1O6",
    "widths": [
      480,
      960,
      1440
    ],
    "w": 1440,
    "h": 1080,
    "url": "assets/research/all-APNQkAFH5nvKwPOs3mVjj1O6-960.webp",
    "urlFull": "assets/research/all-APNQkAFH5nvKwPOs3mVjj1O6-1440.webp",
    "alt": {
      "en": "All (Google Maps)",
      "vi": "All (Google Maps)"
    }
  },
  {
    "type": "image",
    "base": "assets/research/all-APNQkAE-qKu7ripquzkmUacT",
    "widths": [
      480,
      960,
      1440
    ],
    "w": 1440,
    "h": 1080,
    "url": "assets/research/all-APNQkAE-qKu7ripquzkmUacT-960.webp",
    "urlFull": "assets/research/all-APNQkAE-qKu7ripquzkmUacT-1440.webp",
    "alt": {
      "en": "All (Google Maps)",
      "vi": "All (Google Maps)"
    }
  }
];

window.REVIEWS = [
  {
    "stars": 5,
    "name": "Robert Davis",
    "text": {
      "en": "NOTE: we went here for food as the reviews are great but it was closed and a neigh our said they had closed the business. Unclear if this was permanently or just until high season begins again."
    },
    "url": "https://www.google.com/maps/reviews/data=!4m8!14m7!1m6!2m5!1sCi9DQUlRQUNvZENodHljRjlvT2xseVRGRmZlbVk0Y1hGVlgyaHJMV1JGWmpadFVXYxAB!2m1!1s0x0:0x9b489c6dad4a16aa!3m1!1s2@1:CAIQACodChtycF9oOllyTFFfemY4cXFVX2hrLWRFZjZtUWc%7C%7C?hl=en",
    "source": "Google"
  },
  {
    "stars": 5,
    "name": "Michael Page",
    "text": {
      "en": "Lovely quiet location just back from the beach. Delicious vegan food. I loved the eggplant and mushroom claypot and the chick pea curry with coconut. Honestly one of the nicest vegan meals in central Vietnam so far."
    },
    "url": "https://www.google.com/maps/reviews/data=!4m8!14m7!1m6!2m5!1sCi9DQUlRQUNvZENodHljRjlvT2xFMFh6VldUMDFwVlRScVZYRkhVek5WYm5acWVGRRAB!2m1!1s0x0:0x9b489c6dad4a16aa!3m1!1s2@1:CAIQACodChtycF9oOlE0XzVWT01pVTRqVXFHUzNVbnZqeFE%7C%7C?hl=en",
    "source": "Google"
  },
  {
    "stars": 5,
    "name": "millie hampson",
    "text": {
      "en": "super good food! good prices! nice staff! :)"
    },
    "url": "https://www.google.com/maps/reviews/data=!4m8!14m7!1m6!2m5!1sCi9DQUlRQUNvZENodHljRjlvT25Nd1ZWY3RUa2xOWm1JNVVuUjZlVTUxVldsTFkwRRAB!2m1!1s0x0:0x9b489c6dad4a16aa!3m1!1s2@1:CAIQACodChtycF9oOnMwVVctTklNZmI5UnR6eU51VWlLY0E%7C%7C?hl=en",
    "source": "Google"
  },
  {
    "stars": 5,
    "name": "Francisca Saldivia Quintana",
    "text": {
      "en": "Amazing option for vegetarians and vegan people 🎉🍀 great and tasty food"
    },
    "url": "https://www.google.com/maps/reviews/data=!4m8!14m7!1m6!2m5!1sCi9DQUlRQUNvZENodHljRjlvT21Sak1rMUdjRmt4UWtkQlpGcHVZV2R2ZVZsUVNIYxAB!2m1!1s0x0:0x9b489c6dad4a16aa!3m1!1s2@1:CAIQACodChtycF9oOmRjMk1GcFkxQkdBZFpuYWdveVlQSHc%7C%7C?hl=en",
    "source": "Google"
  },
  {
    "stars": 5,
    "name": "Christian Otto",
    "text": {
      "en": "Sehr tolles Ambiente im Garten direkt in erster Reihe nach den Strand.\nSuper leckeres Essen und freundliche Bedienung\nGerne wieder\n\n19.05.26"
    },
    "url": "https://www.google.com/maps/reviews/data=!4m8!14m7!1m6!2m5!1sCi9DQUlRQUNvZENodHljRjlvT2xKVk5VOVRNeTFET1hkQ01uSmhlamg0TmxsdGFuYxAB!2m1!1s0x0:0x9b489c6dad4a16aa!3m1!1s2@1:CAIQACodChtycF9oOlJVNU9TMy1DOXdCMnJhejh4Nlltanc%7C%7C?hl=en",
    "source": "Google"
  },
  {
    "stars": 5,
    "name": "M Mul",
    "text": {
      "en": "What a lovely little place, with friendly welcoming staff, near the beach. Great views of a very nice garden. Perfect place to chill in this cosy atmosphere. We had delish vegan ice cream definitely recommend if you are around this area. 🤩"
    },
    "url": "https://www.google.com/maps/reviews/data=!4m8!14m7!1m6!2m5!1sCi9DQUlRQUNvZENodHljRjlvT201T2JFeHJiRTl6UkU1cVNtWlRkbWQxU2t0dk1WRRAB!2m1!1s0x0:0x9b489c6dad4a16aa!3m1!1s2@1:CAIQACodChtycF9oOm5ObExrbE9zRE5qSmZTdmd1SktvMVE%7C%7C?hl=en",
    "source": "Google"
  }
];
