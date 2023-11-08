const oldData = {
    "Model": [
        {
            "JOEY3.0": 1019
        },
        {
            "Joey CR": 690
        },
        {
            "Wireless Joey": 347
        },
        {
            "HOPPERDUO": 352
        },
        {
            "Hopper3": 919
        },
        {
            "WALLY": 485
        },
        {
            "undefined": 933
        },
        {
            "ABA 1020 (PCI card)": 116
        },
        {
            "HOPPER with SLING CR": 585
        },
        {
            "4kJoey": 18
        },
        {
            "SUPER JOEY": 85
        },
        {
            "Hopper with Sling": 544
        },
        {
            "Hopper Plus": 79
        },
        {
            "WIFIJOEY4": 36
        },
        {
            "JOEY4.0": 75
        },
        {
            "ViP722k (LF Main Board)": 60
        },
        {
            "ViP722k": 25
        },
        {
            "ViP211z": 5
        },
        {
            "ViP222k (LF Main Board)": 2
        },
        {
            "ViP211k (LF Main Board)": 4
        },
        {
            "DishPlayer DVR 512 w/DN241 Card": 1
        },
        {
            "ViP222k w/DN241 Card": 1
        },
        {
            "ViP722K w/ DN552 Chip (LF Main Board)": 1
        },
        {
            "ViP612": 2
        }
    ],
    "Spur": [
        {
            "ELP_03": 685
        },
        {
            "ELP_07": 686
        },
        {
            "ELP_08": 427
        },
        {
            "ELP_09": 785
        },
        {
            "ELP_02": 764
        },
        {
            "ELP_05": 840
        },
        {
            "ELP_04": 825
        },
        {
            "ELP_10": 413
        },
        {
            "ELP_01": 38
        }
    ]
  };
  
  function convertData(oldData) {
    const newData = {};
  
    for (const category in oldData) {
      newData[category] = {};
  
      oldData[category].forEach((item) => {
        const key = Object.keys(item)[0];
        const value = item[key];
        newData[category][key] = value;
      });
    }
  
    return newData;
  }
  
  const newData = convertData(oldData);
  console.log(newData);
  