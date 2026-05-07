

const ECO_PRODUCTS = [
  { id: 'COP-25-001', name: 'Cables de Cobre 2.5mm',    category: 'Electrical', stock: 12,  min: 50,  status: 'crítico',   icon: 'bolt',    valor: 8.50  },
  { id: 'INT-TH-092', name: 'Interruptores Térmicos',   category: 'Electrical', stock: 45,  min: 60,  status: 'bajo stock',icon: 'sun',     valor: 12.00 },
  { id: 'BAT-LI-100', name: 'Batería Litio 100Ah',      category: 'Storage',    stock: 124, min: 20,  status: 'óptimo',    icon: 'battery', valor: 550.00},
  { id: 'SOL-PA-060', name: 'Paneles Solares 60W',      category: 'Panels',     stock: 18,  min: 30,  status: 'bajo stock',icon: 'panel',   valor: 95.00 },
  { id: 'LED-PL-060', name: 'LED Panels 60x60',         category: 'Panels',     stock: 76,  min: 20,  status: 'óptimo',    icon: 'panel',   valor: 24.00 },
  { id: 'CIR-BR-20A', name: 'Circuit Breaker 20A',      category: 'Electrical', stock: 33,  min: 40,  status: 'bajo stock',icon: 'bolt',    valor: 18.00 },
  { id: 'CAB-HDM-2M', name: 'Cable HDMI 2m',            category: 'Cables',     stock: 0,   min: 15,  status: 'sin stock', icon: 'plug',    valor: 6.50  },
  { id: 'TER-SW-001', name: 'Thermal Switch 10A',       category: 'Electrical', stock: 7,   min: 25,  status: 'crítico',   icon: 'bolt',    valor: 9.00  },
  { id: 'HER-TOR-01', name: 'Torque Wrench Set',        category: 'Tools',      stock: 12,  min: 5,   status: 'óptimo',    icon: 'tool',    valor: 85.00 },
  { id: 'CAB-UTP-5E', name: 'Cable UTP Cat5e x100m',    category: 'Cables',     stock: 8,   min: 10,  status: 'bajo stock',icon: 'plug',    valor: 32.00 },
  { id: 'BAT-AG-12V', name: 'Batería AGM 12V 200Ah',   category: 'Storage',    stock: 55,  min: 10,  status: 'óptimo',    icon: 'battery', valor: 210.00},
  { id: 'SOL-MO-100', name: 'Solar Module Mono 100W',  category: 'Panels',     stock: 0,   min: 20,  status: 'sin stock', icon: 'panel',   valor: 140.00},
];

function getAlerts() {
  return {
    critico:   ECO_PRODUCTS.filter(p => p.status === 'crítico'),
    bajoStock: ECO_PRODUCTS.filter(p => p.status === 'bajo stock'),
    sinStock:  ECO_PRODUCTS.filter(p => p.status === 'sin stock'),
  };
}

function getTotalAlertCount() {
  const a = getAlerts();
  return a.critico.length + a.bajoStock.length + a.sinStock.length;
}


const ECO_CATALOG = ECO_PRODUCTS.reduce((acc, p) => {
  acc[p.id] = { name: p.name, category: p.category, stock: p.stock, icon: p.icon, valor: p.valor };
  return acc;
}, {});
