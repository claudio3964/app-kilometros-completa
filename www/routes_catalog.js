window.routes = [

  // ===== MONTEVIDEO → DESTINOS =====
  { origen: "Montevideo", destino: "Colonia", km: 178, carteles: { marcopolo: "L143", neobus: "L176" } },
  { origen: "Montevideo", destino: "Punta del Este", km: 140, carteles: { marcopolo: "L023", neobus: "L048" } },
  { origen: "Montevideo", destino: "Punta del Este x Piriápolis", km: 145, carteles: { marcopolo: "L023", neobus: "L048" } },
  { origen: "Montevideo", destino: "Punta del Este x Pan de Azúcar y San Carlos", km: 155, carteles: { marcopolo: "L023", neobus: "L048" } },
  { origen: "Montevideo", destino: "Punta del Este x Ruta 8 y 9", km: 165, carteles: { marcopolo: "L023", neobus: "L048" } },
  { origen: "Montevideo", destino: "Piriápolis", km: 97, carteles: { marcopolo: "L063", neobus: "L000" } },
  { origen: "Montevideo", destino: "Punta Negra", km: 112, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Montevideo", destino: "Laguna Garzón", km: 183, carteles: { marcopolo: "L014", neobus: "L066" } },
  { origen: "Montevideo", destino: "La Paloma", km: 220, carteles: { marcopolo: "L133", neobus: "L081" } },
  { origen: "Montevideo", destino: "La Pedrera", km: 250, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Montevideo", destino: "Rocha", km: 220, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Montevideo", destino: "Aguas Dulces", km: 290, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Montevideo", destino: "Chuy", km: 345, carteles: { marcopolo: "L073", neobus: "L128" } },

  // ===== REGRESOS A MONTEVIDEO =====
  { origen: "Colonia", destino: "Montevideo", km: 178, carteles: { marcopolo: "L183", neobus: "L240" } },
  { origen: "Punta del Este", destino: "Montevideo", km: 140, carteles: { marcopolo: "L183", neobus: "L241" } },
  { origen: "Piriápolis", destino: "Montevideo", km: 97, carteles: { marcopolo: "L183", neobus: "L240" } },
  { origen: "Punta Negra", destino: "Montevideo", km: 112, carteles: { marcopolo: "184", neobus: "240" } },
  { origen: "Laguna Garzón", destino: "Montevideo", km: 183, carteles: { marcopolo: "L183", neobus: "L240" } },
  { origen: "La Paloma", destino: "Montevideo", km: 220, carteles: { marcopolo: "L183", neobus: "L240" } },
  { origen: "La Pedrera", destino: "Montevideo", km: 250, carteles: { marcopolo: "183", neobus: "240" } },
  { origen: "Rocha", destino: "Montevideo", km: 220, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Aguas Dulces", destino: "Montevideo", km: 290, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Chuy", destino: "Montevideo", km: 345, carteles: { marcopolo: "L183", neobus: "L240" } },

  // ===== INTERMEDIOS PUNTA DEL ESTE =====
  { origen: "Punta del Este", destino: "Piriápolis", km: 40, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Punta del Este", destino: "Punta Negra", km: 28, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Punta del Este", destino: "Laguna Garzón", km: 50, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Punta del Este", destino: "La Pedrera", km: 150, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Punta del Este", destino: "Chuy", km: 235, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Punta del Este", destino: "San Carlos", km: 30, carteles: { marcopolo: "", neobus: "" } },

  // ===== REGRESOS DESDE PUNTA DEL ESTE =====
  { origen: "Piriápolis", destino: "Punta del Este", km: 40, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Punta Negra", destino: "Punta del Este", km: 28, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Laguna Garzón", destino: "Punta del Este", km: 50, carteles: { marcopolo: "", neobus: "" } },
  { origen: "La Pedrera", destino: "Punta del Este", km: 150, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Chuy", destino: "Punta del Este", km: 245, carteles: { marcopolo: "", neobus: "" } },
  { origen: "San Carlos", destino: "Punta del Este", km: 30, carteles: { marcopolo: "", neobus: "" } },

  // ===== INTERMEDIOS PIRIÁPOLIS =====
  { origen: "Piriápolis", destino: "Punta Colorada", km: 15, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Piriápolis", destino: "Punta Negra", km: 12, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Piriápolis", destino: "Cuchilla Alta", km: 30, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Punta Colorada", destino: "Piriápolis", km: 15, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Punta Negra", destino: "Piriápolis", km: 12, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Cuchilla Alta", destino: "Piriápolis", km: 30, carteles: { marcopolo: "", neobus: "" } },

  // ===== INTERMEDIOS ROCHA =====
  { origen: "Rocha", destino: "Chuy", km: 120, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Rocha", destino: "La Paloma", km: 35, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Rocha", destino: "La Pedrera", km: 40, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Rocha", destino: "Aguas Dulces", km: 70, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Chuy", destino: "Rocha", km: 120, carteles: { marcopolo: "", neobus: "" } },
  { origen: "La Paloma", destino: "Rocha", km: 35, carteles: { marcopolo: "", neobus: "" } },
  { origen: "La Pedrera", destino: "Rocha", km: 40, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Aguas Dulces", destino: "Rocha", km: 70, carteles: { marcopolo: "", neobus: "" } },
  { origen: "La Paloma", destino: "Chuy", km: 120, carteles: { marcopolo: "", neobus: "" } },
  { origen: "Chuy", destino: "La Paloma", km: 120, carteles: { marcopolo: "", neobus: "" } }

];
