// ======================================
// CATALOGO DE CARTELES COT
// Estructura: destino → coche → servicio → código
// ======================================

console.log("CATALOGO CARTELES CARGADO");

window.ROUTES_SIGNS = {

  "laguna garzon": {
    marcopolo: {
      directo:    "L013",
      turno:      "L014",
      "x piria":  "L017"
    },
    neobus: {
      turno:       "L064",
      directisimo: "L065",
      directo:     "L066",
      "x piriapolis": "L067"
    }
  },

  "punta del este": {
    marcopolo: {
      directo:               "L023",
      turno:                 "L024",
      directisimo:           "L025",
      "x ruta 8":            "L026",
      "x piria":             "L027",
      "x p azucar y s carlos": "L029"
    },
    neobus: {
      turno:                        "L048",
      directisimo:                  "L049",
      directo:                      "L050",
      "x piriapolis":               "L051",
      "x pan de azucar y san carlos": "L052",
      "x ruta 8":                   "L057"
    }
  },

  "punta colorada": {
    marcopolo: {
      directo:     "L053",
      turno:       "L054",
      directisimo: "L055"
    },
    neobus: {
      turno:       "L016",
      directisimo: "L017"
    }
  },

  "piriapolis": {
    marcopolo: {
      directo:     "L063",
      turno:       "L064",
      directisimo: "L065"
    },
    neobus: {
      turno:       "L000",
      directisimo: "L001",
      directo:     "L002"
    }
  },

  "chuy": {
    marcopolo: {
      directo:                 "L073",
      turno:                   "L074",
      directisimo:             "L075",
      "x ruta 8":              "L076",
      "x p azucar y s carlos": "L079"
    },
    neobus: {
      turno:                        "L128",
      directisimo:                  "L129",
      directo:                      "L130",
      "x piriapolis":               "L131",
      "x pan de azucar y san carlos": "L132"
    }
  },

  "la pedrera": {
    marcopolo: {
      directo:                 "L123",
      turno:                   "L124",
      directisimo:             "L125",
      "x p azucar y s carlos": "L129"
    },
    neobus: {
      turno:                        "L096",
      directisimo:                  "L097",
      directo:                      "L098",
      "x piriapolis":               "L099",
      "x pan de azucar y san carlos": "L100",
      "x rocha":                    "L102"
    }
  },

  "la paloma": {
    marcopolo: {
      directo:                 "L133",
      turno:                   "L134",
      directisimo:             "L135",
      "x p azucar y s carlos": "L139"
    },
    neobus: {
      turno:                        "L080",
      directisimo:                  "L081",
      directo:                      "L082",
      "x pan de azucar y san carlos": "L084",
      "x rocha":                    "L086"
    }
  },

  "colonia": {
    marcopolo: {
      directo:     "L143",
      turno:       "L144",
      directisimo: "L145"
    },
    neobus: {
      turno:       "L176",
      directisimo: "L177",
      directo:     "L178"
    }
  },

  "montevideo": {
    marcopolo: {
      directo:                 "L183",
      turno:                   "L184",
      directisimo:             "L185",
      "x ruta 8":              "L186",
      "x piria":               "L187",
      "x s carlos y p azucar": "L188"
    },
    neobus: {
      turno:                        "L240",
      directisimo:                  "L241",
      directo:                      "L242",
      "x piriapolis":               "L243",
      "x san carlos y pan de azucar": "L245",
      "x rocha":                    "L246",
      "x ruta 8":                   "L249"
    }
  },

  "punta negra": {
    marcopolo: {
      turno:   "L204",
      directo: "L205"
    },
    neobus: {
      turno:       "L352",
      directisimo: "L353",
      directo:     "L354"
    }
  },

  "_especiales": {
    marcopolo: {
      "buemes contratado":    "L191",
      "turisport contratado": "L201",
      expreso:                "L202",
      excursion:              "L203"
    },
    neobus: {
      contratado: "L347",
      expreso:    "L348"
    }
  }

};
