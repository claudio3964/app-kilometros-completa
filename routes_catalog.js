const ROUTES_CATALOG = {
 "punta del este x piriapolis": { marcopolo: "L026", neobus: "L050" },
 "punta del este": { marcopolo: "L025", neobus: "L049" },
 "piriapolis": { marcopolo: "L063", neobus: "L000" },
 "laguna garzon": { marcopolo: "L014", neobus: "L066" },
 "la pedrera": { marcopolo: "L123", neobus: "L099" },
 "la paloma": { marcopolo: "L133", neobus: "L081" },
 "chuy": { marcopolo: "L073", neobus: "L128" },
 "colonia": { marcopolo: "L143", neobus: "L176" }
};

window.obtenerCodigosRuta = function(destino){

 if(!destino) return null;

 const key = destino
   .toLowerCase()
   .trim();

 return ROUTES_CATALOG[key] || null;
}
