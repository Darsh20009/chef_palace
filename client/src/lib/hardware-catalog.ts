export type HardwareCategory =
  | 'pos_terminal'
  | 'receipt_printer'
  | 'kitchen_printer'
  | 'label_printer'
  | 'fingerprint'
  | 'barcode_scanner'
  | 'cash_drawer'
  | 'customer_display'
  | 'payment_terminal'
  | 'network_switch'
  | 'kds_screen'
  | 'scale';

export type ConnectionType = 'usb' | 'lan' | 'serial' | 'bluetooth' | 'wifi' | 'rs232' | 'rj11' | 'cloud';

export interface HardwareDevice {
  id: string;
  brand: string;
  brandAr: string;
  model: string;
  category: HardwareCategory;
  connection: ConnectionType[];
  defaultIp?: string;
  ipRange?: string;
  port?: number;
  protocol?: string;
  baudRate?: number;
  paperWidth?: number;
  supported: 'full' | 'partial' | 'network';
  popular: boolean;
  saudiPopular?: boolean;
  notes?: string;
  notesAr?: string;
  vendorId?: string;
  productId?: string;
}

export const CATEGORY_INFO: Record<HardwareCategory, { nameAr: string; nameEn: string; icon: string; color: string }> = {
  pos_terminal:      { nameAr: 'أجهزة POS', nameEn: 'POS Terminals', icon: '🖥️', color: 'blue' },
  receipt_printer:   { nameAr: 'طابعات الإيصالات', nameEn: 'Receipt Printers', icon: '🖨️', color: 'green' },
  kitchen_printer:   { nameAr: 'طابعات المطبخ', nameEn: 'Kitchen Printers', icon: '👨‍🍳', color: 'orange' },
  label_printer:     { nameAr: 'طابعات الملصقات', nameEn: 'Label Printers', icon: '🏷️', color: 'yellow' },
  fingerprint:       { nameAr: 'أجهزة البصمة', nameEn: 'Fingerprint Readers', icon: '👆', color: 'purple' },
  barcode_scanner:   { nameAr: 'ماسحات الباركود', nameEn: 'Barcode Scanners', icon: '📷', color: 'teal' },
  cash_drawer:       { nameAr: 'أدراج النقد', nameEn: 'Cash Drawers', icon: '💰', color: 'emerald' },
  customer_display:  { nameAr: 'شاشات العملاء', nameEn: 'Customer Displays', icon: '📺', color: 'cyan' },
  payment_terminal:  { nameAr: 'أجهزة الدفع', nameEn: 'Payment Terminals', icon: '💳', color: 'rose' },
  network_switch:    { nameAr: 'معدات الشبكة', nameEn: 'Network Equipment', icon: '🔌', color: 'slate' },
  kds_screen:        { nameAr: 'شاشات المطبخ KDS', nameEn: 'KDS Screens', icon: '📟', color: 'amber' },
  scale:             { nameAr: 'موازين', nameEn: 'Scales', icon: '⚖️', color: 'gray' },
};

export const HARDWARE_CATALOG: HardwareDevice[] = [
  // ─────────────────────── POS TERMINALS ───────────────────────
  { id: 'sunmi-v2s', brand: 'Sunmi', brandAr: 'سونمي', model: 'V2s', category: 'pos_terminal', connection: ['wifi', 'bluetooth'], protocol: 'Android SDK', supported: 'full', popular: true, saudiPopular: true, notesAr: 'الأكثر انتشاراً في السعودية' },
  { id: 'sunmi-v2s-pro', brand: 'Sunmi', brandAr: 'سونمي', model: 'V2s Pro', category: 'pos_terminal', connection: ['wifi', 'bluetooth'], protocol: 'Android SDK', supported: 'full', popular: true, saudiPopular: true },
  { id: 'sunmi-t2-mini', brand: 'Sunmi', brandAr: 'سونمي', model: 'T2 Mini', category: 'pos_terminal', connection: ['lan', 'wifi'], protocol: 'Android SDK', defaultIp: '192.168.1.100', port: 9100, supported: 'full', popular: true, saudiPopular: true },
  { id: 'sunmi-d2-mini', brand: 'Sunmi', brandAr: 'سونمي', model: 'D2 Mini', category: 'pos_terminal', connection: ['lan', 'wifi'], protocol: 'Android SDK', defaultIp: '192.168.1.101', supported: 'full', popular: true },
  { id: 'sunmi-p2', brand: 'Sunmi', brandAr: 'سونمي', model: 'P2', category: 'pos_terminal', connection: ['wifi', 'bluetooth'], protocol: 'Android SDK', supported: 'full', popular: false },
  { id: 'sunmi-l2s', brand: 'Sunmi', brandAr: 'سونمي', model: 'L2s', category: 'pos_terminal', connection: ['wifi', 'bluetooth'], protocol: 'Android SDK', supported: 'full', popular: false },
  { id: 'imin-d4', brand: 'IMIN', brandAr: 'إيمن', model: 'D4', category: 'pos_terminal', connection: ['lan', 'wifi'], protocol: 'Android SDK', defaultIp: '192.168.1.102', supported: 'full', popular: true },
  { id: 'imin-f2', brand: 'IMIN', brandAr: 'إيمن', model: 'F2', category: 'pos_terminal', connection: ['wifi', 'bluetooth'], protocol: 'Android SDK', supported: 'full', popular: true },
  { id: 'imin-m2', brand: 'IMIN', brandAr: 'إيمن', model: 'M2', category: 'pos_terminal', connection: ['wifi', 'bluetooth'], protocol: 'Android SDK', supported: 'full', popular: false },
  { id: 'imin-d3', brand: 'IMIN', brandAr: 'إيمن', model: 'D3', category: 'pos_terminal', connection: ['lan', 'wifi'], protocol: 'Android SDK', defaultIp: '192.168.1.103', supported: 'full', popular: true },
  { id: 'pax-a920', brand: 'PAX', brandAr: 'باكس', model: 'A920', category: 'pos_terminal', connection: ['wifi', 'bluetooth'], protocol: 'PAX SDK', supported: 'partial', popular: true },
  { id: 'pax-a35', brand: 'PAX', brandAr: 'باكس', model: 'A35', category: 'pos_terminal', connection: ['lan', 'wifi'], protocol: 'PAX SDK', defaultIp: '192.168.1.104', supported: 'partial', popular: false },
  { id: 'pax-a80', brand: 'PAX', brandAr: 'باكس', model: 'A80', category: 'pos_terminal', connection: ['lan', 'wifi'], protocol: 'PAX SDK', supported: 'partial', popular: false },
  { id: 'telpo-tps560b', brand: 'Telpo', brandAr: 'تيلبو', model: 'TPS560B', category: 'pos_terminal', connection: ['wifi', 'bluetooth'], protocol: 'Android SDK', supported: 'full', popular: false },
  { id: 'telpo-tps570', brand: 'Telpo', brandAr: 'تيلبو', model: 'TPS570', category: 'pos_terminal', connection: ['wifi', 'bluetooth'], protocol: 'Android SDK', supported: 'full', popular: false },
  { id: 'urovo-i9100s', brand: 'Urovo', brandAr: 'يوروفو', model: 'i9100s', category: 'pos_terminal', connection: ['wifi', 'bluetooth'], protocol: 'Android SDK', supported: 'full', popular: false },
  { id: 'verifone-v200c', brand: 'Verifone', brandAr: 'فيريفون', model: 'V200c', category: 'pos_terminal', connection: ['lan', 'wifi'], protocol: 'Verifone SDK', defaultIp: '192.168.1.105', supported: 'partial', popular: false },
  { id: 'posiflex-xt3815', brand: 'Posiflex', brandAr: 'بوسيفلكس', model: 'XT-3815', category: 'pos_terminal', connection: ['usb', 'lan'], protocol: 'OPOS/JPOS', defaultIp: '192.168.1.110', supported: 'partial', popular: false },

  // ─────────────────────── RECEIPT PRINTERS ───────────────────────
  { id: 'epson-tm-t20iii', brand: 'Epson', brandAr: 'إبسون', model: 'TM-T20III', category: 'receipt_printer', connection: ['usb', 'serial', 'lan'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.1.200', baudRate: 9600, paperWidth: 80, supported: 'full', popular: true, saudiPopular: true, vendorId: '04B8', productId: '0202' },
  { id: 'epson-tm-t82iii', brand: 'Epson', brandAr: 'إبسون', model: 'TM-T82III', category: 'receipt_printer', connection: ['usb', 'serial', 'lan'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.1.201', baudRate: 9600, paperWidth: 80, supported: 'full', popular: true, saudiPopular: true },
  { id: 'epson-tm-t88vii', brand: 'Epson', brandAr: 'إبسون', model: 'TM-T88VII', category: 'receipt_printer', connection: ['usb', 'lan', 'wifi'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.1.202', paperWidth: 80, supported: 'full', popular: true },
  { id: 'epson-tm-t70', brand: 'Epson', brandAr: 'إبسون', model: 'TM-T70II', category: 'receipt_printer', connection: ['usb', 'serial', 'lan'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.1.203', paperWidth: 80, supported: 'full', popular: false },
  { id: 'epson-tm-m30ii', brand: 'Epson', brandAr: 'إبسون', model: 'TM-m30II', category: 'receipt_printer', connection: ['usb', 'lan', 'wifi', 'bluetooth'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.1.204', paperWidth: 80, supported: 'full', popular: true },
  { id: 'epson-tm-t20ii', brand: 'Epson', brandAr: 'إبسون', model: 'TM-T20II', category: 'receipt_printer', connection: ['usb', 'serial'], protocol: 'ESC/POS', baudRate: 9600, paperWidth: 80, supported: 'full', popular: false },
  { id: 'epson-tm-p20', brand: 'Epson', brandAr: 'إبسون', model: 'TM-P20', category: 'receipt_printer', connection: ['wifi', 'bluetooth'], protocol: 'ESC/POS', paperWidth: 58, supported: 'full', popular: false },
  { id: 'star-tsp100', brand: 'Star Micronics', brandAr: 'ستار مايكرونكس', model: 'TSP100', category: 'receipt_printer', connection: ['usb', 'lan'], protocol: 'ESC/POS + Star Mode', port: 9100, defaultIp: '192.168.1.210', paperWidth: 80, supported: 'full', popular: true, vendorId: '0519' },
  { id: 'star-tsp143', brand: 'Star Micronics', brandAr: 'ستار مايكرونكس', model: 'TSP143IIIW', category: 'receipt_printer', connection: ['usb', 'lan', 'wifi'], protocol: 'Star Mode', port: 9100, defaultIp: '192.168.1.211', paperWidth: 80, supported: 'full', popular: true },
  { id: 'star-tsp650', brand: 'Star Micronics', brandAr: 'ستار مايكرونكس', model: 'TSP650II', category: 'receipt_printer', connection: ['usb', 'serial', 'lan'], protocol: 'Star Mode', port: 9100, defaultIp: '192.168.1.212', paperWidth: 80, supported: 'full', popular: true },
  { id: 'star-tsp700', brand: 'Star Micronics', brandAr: 'ستار مايكرونكس', model: 'TSP700II', category: 'receipt_printer', connection: ['serial', 'lan'], protocol: 'Star Mode', port: 9100, defaultIp: '192.168.1.213', paperWidth: 80, supported: 'full', popular: false },
  { id: 'star-mcp31', brand: 'Star Micronics', brandAr: 'ستار مايكرونكس', model: 'mC-Print3', category: 'receipt_printer', connection: ['usb', 'lan', 'bluetooth'], protocol: 'Star Mode / ESC/POS', port: 9100, defaultIp: '192.168.1.214', paperWidth: 80, supported: 'full', popular: false },
  { id: 'bixolon-srp350', brand: 'Bixolon', brandAr: 'بيكسولون', model: 'SRP-350', category: 'receipt_printer', connection: ['usb', 'serial', 'lan'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.1.220', paperWidth: 80, supported: 'full', popular: true, vendorId: '1504' },
  { id: 'bixolon-srp380', brand: 'Bixolon', brandAr: 'بيكسولون', model: 'SRP-380', category: 'receipt_printer', connection: ['usb', 'lan', 'wifi'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.1.221', paperWidth: 80, supported: 'full', popular: false },
  { id: 'bixolon-srp500', brand: 'Bixolon', brandAr: 'بيكسولون', model: 'SRP-500', category: 'receipt_printer', connection: ['usb', 'lan'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.1.222', paperWidth: 80, supported: 'full', popular: false },
  { id: 'bixolon-srp-q300', brand: 'Bixolon', brandAr: 'بيكسولون', model: 'SRP-Q300', category: 'receipt_printer', connection: ['usb', 'lan', 'wifi', 'bluetooth'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.1.223', paperWidth: 80, supported: 'full', popular: false },
  { id: 'xprinter-xp80', brand: 'Xprinter', brandAr: 'إكس برينتر', model: 'XP-80C', category: 'receipt_printer', connection: ['usb', 'lan'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.1.230', paperWidth: 80, supported: 'full', popular: true, saudiPopular: true, notesAr: 'أرخص وأكثر انتشاراً في السوق' },
  { id: 'xprinter-xp58', brand: 'Xprinter', brandAr: 'إكس برينتر', model: 'XP-58IIH', category: 'receipt_printer', connection: ['usb', 'bluetooth'], protocol: 'ESC/POS', paperWidth: 58, supported: 'full', popular: true },
  { id: 'xprinter-xp420b', brand: 'Xprinter', brandAr: 'إكس برينتر', model: 'XP-420B', category: 'receipt_printer', connection: ['usb', 'bluetooth'], protocol: 'ESC/POS', paperWidth: 58, supported: 'full', popular: false },
  { id: 'sewoo-lkt200', brand: 'Sewoo', brandAr: 'سيوو', model: 'LK-T200', category: 'receipt_printer', connection: ['usb', 'serial', 'lan'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.1.240', paperWidth: 80, supported: 'full', popular: false },
  { id: 'sewoo-lkt210', brand: 'Sewoo', brandAr: 'سيوو', model: 'LK-T210', category: 'receipt_printer', connection: ['usb', 'lan'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.1.241', paperWidth: 80, supported: 'full', popular: false },
  { id: 'snbc-btpr880', brand: 'SNBC', brandAr: 'SNBC', model: 'BTP-R880', category: 'receipt_printer', connection: ['usb', 'serial', 'lan'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.1.245', paperWidth: 80, supported: 'full', popular: false },
  { id: 'citizen-cts310', brand: 'Citizen', brandAr: 'سيتيزن', model: 'CT-S310', category: 'receipt_printer', connection: ['usb', 'serial'], protocol: 'ESC/POS', baudRate: 9600, paperWidth: 80, supported: 'full', popular: false },
  { id: 'citizen-cts600', brand: 'Citizen', brandAr: 'سيتيزن', model: 'CT-S600', category: 'receipt_printer', connection: ['usb', 'serial', 'lan'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.1.250', paperWidth: 80, supported: 'full', popular: false },
  { id: 'citizen-cts800', brand: 'Citizen', brandAr: 'سيتيزن', model: 'CT-S800', category: 'receipt_printer', connection: ['usb', 'serial', 'lan'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.1.251', paperWidth: 80, supported: 'full', popular: false },
  { id: 'posiflex-aura7000', brand: 'Posiflex', brandAr: 'بوسيفلكس', model: 'AURA-7000', category: 'receipt_printer', connection: ['usb', 'lan'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.1.252', paperWidth: 80, supported: 'full', popular: false },
  { id: 'sam4s-ellix55', brand: 'Sam4s', brandAr: 'سام فور إس', model: 'ELLIX 55', category: 'receipt_printer', connection: ['usb', 'serial', 'lan'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.1.253', paperWidth: 80, supported: 'full', popular: false },
  { id: 'goojprt-pt80', brand: 'GOOJPRT', brandAr: 'جووجبرت', model: 'PT-80', category: 'receipt_printer', connection: ['usb', 'bluetooth'], protocol: 'ESC/POS', paperWidth: 80, supported: 'full', popular: true, saudiPopular: true, notesAr: 'اقتصادية وشائعة جداً' },
  { id: 'goojprt-pt58', brand: 'GOOJPRT', brandAr: 'جووجبرت', model: 'PT-58', category: 'receipt_printer', connection: ['usb', 'bluetooth'], protocol: 'ESC/POS', paperWidth: 58, supported: 'full', popular: false },
  { id: 'custom-vkp80', brand: 'Custom', brandAr: 'كستوم', model: 'VKP80', category: 'receipt_printer', connection: ['usb', 'serial', 'lan'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.1.254', paperWidth: 80, supported: 'full', popular: false },
  { id: 'rongta-rp80', brand: 'Rongta', brandAr: 'رونجتا', model: 'RP80USE', category: 'receipt_printer', connection: ['usb', 'serial', 'lan'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.2.200', paperWidth: 80, supported: 'full', popular: false },
  { id: 'gainscha-gp80', brand: 'Gainscha', brandAr: 'جينشا', model: 'GP-80160', category: 'receipt_printer', connection: ['usb', 'lan'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.2.201', paperWidth: 80, supported: 'full', popular: false },

  // ─────────────────────── KITCHEN PRINTERS ───────────────────────
  { id: 'epson-tm-t82iii-k', brand: 'Epson', brandAr: 'إبسون', model: 'TM-T82III (Kitchen)', category: 'kitchen_printer', connection: ['lan', 'usb'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.1.150', paperWidth: 80, supported: 'full', popular: true, notesAr: 'مطبخ - قسم المشروبات' },
  { id: 'epson-tm-t20iii-k', brand: 'Epson', brandAr: 'إبسون', model: 'TM-T20III (Kitchen)', category: 'kitchen_printer', connection: ['lan', 'usb'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.1.151', paperWidth: 80, supported: 'full', popular: true, notesAr: 'مطبخ - قسم الطعام' },
  { id: 'star-tsp650-k', brand: 'Star Micronics', brandAr: 'ستار مايكرونكس', model: 'TSP650II (Kitchen)', category: 'kitchen_printer', connection: ['lan', 'serial'], protocol: 'Star Mode', port: 9100, defaultIp: '192.168.1.152', paperWidth: 80, supported: 'full', popular: false },
  { id: 'custom-q3-kitchen', brand: 'Custom', brandAr: 'كستوم', model: 'Q3 Kitchen', category: 'kitchen_printer', connection: ['lan'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.1.153', paperWidth: 80, supported: 'full', popular: false },
  { id: 'xprinter-xp80-k', brand: 'Xprinter', brandAr: 'إكس برينتر', model: 'XP-80C (Kitchen)', category: 'kitchen_printer', connection: ['lan'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.1.154', paperWidth: 80, supported: 'full', popular: true },

  // ─────────────────────── LABEL PRINTERS ───────────────────────
  { id: 'zebra-gk420d', brand: 'Zebra', brandAr: 'زيبرا', model: 'GK420d', category: 'label_printer', connection: ['usb', 'lan'], protocol: 'ZPL', port: 9100, defaultIp: '192.168.1.160', supported: 'partial', popular: true },
  { id: 'zebra-zd220', brand: 'Zebra', brandAr: 'زيبرا', model: 'ZD220', category: 'label_printer', connection: ['usb', 'bluetooth'], protocol: 'ZPL', supported: 'partial', popular: false },
  { id: 'brother-td4410d', brand: 'Brother', brandAr: 'براذر', model: 'TD-4410D', category: 'label_printer', connection: ['usb', 'lan'], protocol: 'ESC/P', port: 9100, defaultIp: '192.168.1.161', supported: 'partial', popular: false },
  { id: 'dymo-labelwriter', brand: 'Dymo', brandAr: 'دايمو', model: 'LabelWriter 450', category: 'label_printer', connection: ['usb'], protocol: 'Dymo SDK', supported: 'partial', popular: false },
  { id: 'xprinter-xn160', brand: 'Xprinter', brandAr: 'إكس برينتر', model: 'XP-N160', category: 'label_printer', connection: ['usb', 'bluetooth'], protocol: 'TSC', supported: 'full', popular: false },
  { id: 'tsc-ttp244', brand: 'TSC', brandAr: 'TSC', model: 'TTP-244CE', category: 'label_printer', connection: ['usb', 'serial', 'lan'], protocol: 'TSC', port: 9100, defaultIp: '192.168.1.162', supported: 'partial', popular: false },

  // ─────────────────────── FINGERPRINT / BIOMETRIC ───────────────────────
  { id: 'zkteco-k40', brand: 'ZKTeco', brandAr: 'ZK تيكو', model: 'K40', category: 'fingerprint', connection: ['lan', 'usb'], protocol: 'ZKTeco SDK / TCP', port: 4370, defaultIp: '192.168.1.201', ipRange: '192.168.1.x', supported: 'full', popular: true, saudiPopular: true, notesAr: 'الأكثر انتشاراً في السعودية' },
  { id: 'zkteco-k50', brand: 'ZKTeco', brandAr: 'ZK تيكو', model: 'K50', category: 'fingerprint', connection: ['lan', 'usb'], protocol: 'ZKTeco SDK / TCP', port: 4370, defaultIp: '192.168.1.202', supported: 'full', popular: true, saudiPopular: true },
  { id: 'zkteco-f18', brand: 'ZKTeco', brandAr: 'ZK تيكو', model: 'F18', category: 'fingerprint', connection: ['lan', 'usb'], protocol: 'ZKTeco SDK / TCP', port: 4370, defaultIp: '192.168.1.203', supported: 'full', popular: true, saudiPopular: true },
  { id: 'zkteco-f22', brand: 'ZKTeco', brandAr: 'ZK تيكو', model: 'F22', category: 'fingerprint', connection: ['lan', 'usb'], protocol: 'ZKTeco SDK / TCP', port: 4370, defaultIp: '192.168.1.204', supported: 'full', popular: true },
  { id: 'zkteco-iclock560', brand: 'ZKTeco', brandAr: 'ZK تيكو', model: 'iClock560', category: 'fingerprint', connection: ['lan', 'usb'], protocol: 'ZKTeco SDK / TCP', port: 4370, defaultIp: '192.168.1.205', supported: 'full', popular: false },
  { id: 'zkteco-uface202', brand: 'ZKTeco', brandAr: 'ZK تيكو', model: 'uFace202', category: 'fingerprint', connection: ['lan'], protocol: 'ZKTeco SDK / TCP', port: 4370, defaultIp: '192.168.1.206', supported: 'full', popular: false, notesAr: 'يدعم التعرف على الوجه + البصمة' },
  { id: 'zkteco-speedface-h5l', brand: 'ZKTeco', brandAr: 'ZK تيكو', model: 'SpeedFace-H5L', category: 'fingerprint', connection: ['lan', 'wifi'], protocol: 'ZKTeco SDK / TCP', port: 4370, defaultIp: '192.168.1.207', supported: 'full', popular: false, notesAr: 'تعرف وجه + بصمة + كارت' },
  { id: 'zkteco-mb360', brand: 'ZKTeco', brandAr: 'ZK تيكو', model: 'MB360', category: 'fingerprint', connection: ['lan', 'wifi'], protocol: 'ZKTeco SDK / TCP', port: 4370, defaultIp: '192.168.1.208', supported: 'full', popular: false },
  { id: 'zkteco-k80', brand: 'ZKTeco', brandAr: 'ZK تيكو', model: 'K80', category: 'fingerprint', connection: ['lan', 'usb'], protocol: 'ZKTeco SDK / TCP', port: 4370, defaultIp: '192.168.1.209', supported: 'full', popular: false },
  { id: 'zkteco-g3', brand: 'ZKTeco', brandAr: 'ZK تيكو', model: 'G3 Pro', category: 'fingerprint', connection: ['lan'], protocol: 'ZKTeco SDK / TCP', port: 4370, defaultIp: '192.168.1.210', supported: 'full', popular: false, notesAr: 'الجيل الجديد مع شاشة ملونة' },
  { id: 'suprema-biostation-t2', brand: 'Suprema', brandAr: 'سوبريما', model: 'BioStation T2', category: 'fingerprint', connection: ['lan'], protocol: 'BioStar API', port: 1480, defaultIp: '192.168.1.220', supported: 'partial', popular: false },
  { id: 'anviz-w1pro', brand: 'Anviz', brandAr: 'أنفيز', model: 'W1 Pro', category: 'fingerprint', connection: ['lan', 'wifi'], protocol: 'Anviz SDK / TCP', port: 5010, defaultIp: '192.168.1.225', supported: 'partial', popular: false },
  { id: 'anviz-ep300', brand: 'Anviz', brandAr: 'أنفيز', model: 'EP300', category: 'fingerprint', connection: ['lan', 'usb'], protocol: 'Anviz SDK', port: 5010, defaultIp: '192.168.1.226', supported: 'partial', popular: false },
  { id: 'hikvision-ds-k1t342', brand: 'Hikvision', brandAr: 'هيك فيجن', model: 'DS-K1T342', category: 'fingerprint', connection: ['lan'], protocol: 'ISAPI HTTP', port: 80, defaultIp: '192.168.1.64', ipRange: '192.168.1.x', supported: 'partial', popular: false, saudiPopular: true, notesAr: 'يستخدم HTTP REST API' },
  { id: 'dahua-vto2201f', brand: 'Dahua', brandAr: 'داهوا', model: 'ASI3214A', category: 'fingerprint', connection: ['lan'], protocol: 'Dahua SDK', port: 37777, defaultIp: '192.168.1.108', supported: 'partial', popular: false },

  // ─────────────────────── BARCODE SCANNERS ───────────────────────
  { id: 'honeywell-1200g', brand: 'Honeywell', brandAr: 'هانيول', model: 'Voyager 1200G', category: 'barcode_scanner', connection: ['usb'], protocol: 'HID USB', supported: 'full', popular: true, vendorId: '0C2E' },
  { id: 'honeywell-1250g', brand: 'Honeywell', brandAr: 'هانيول', model: 'Voyager 1250G', category: 'barcode_scanner', connection: ['usb'], protocol: 'HID USB', supported: 'full', popular: true },
  { id: 'honeywell-1450g', brand: 'Honeywell', brandAr: 'هانيول', model: 'Granit 1450G', category: 'barcode_scanner', connection: ['usb', 'bluetooth'], protocol: 'HID USB', supported: 'full', popular: false },
  { id: 'zebra-ls2208', brand: 'Zebra', brandAr: 'زيبرا', model: 'LS2208', category: 'barcode_scanner', connection: ['usb', 'serial'], protocol: 'HID USB', supported: 'full', popular: true, vendorId: '05E0' },
  { id: 'zebra-ds2208', brand: 'Zebra', brandAr: 'زيبرا', model: 'DS2208', category: 'barcode_scanner', connection: ['usb'], protocol: 'HID USB', supported: 'full', popular: true },
  { id: 'zebra-li2208', brand: 'Zebra', brandAr: 'زيبرا', model: 'LI2208', category: 'barcode_scanner', connection: ['usb'], protocol: 'HID USB', supported: 'full', popular: false },
  { id: 'datalogic-qd2430', brand: 'Datalogic', brandAr: 'داتالوجيك', model: 'QuickScan QD2430', category: 'barcode_scanner', connection: ['usb'], protocol: 'HID USB', supported: 'full', popular: false },
  { id: 'newland-hr1150', brand: 'Newland', brandAr: 'نيولاند', model: 'HR1150', category: 'barcode_scanner', connection: ['usb'], protocol: 'HID USB', supported: 'full', popular: false },
  { id: 'opticon-opm2006', brand: 'Opticon', brandAr: 'أوبتيكون', model: 'OPM-2006', category: 'barcode_scanner', connection: ['usb'], protocol: 'HID USB', supported: 'full', popular: false },
  { id: 'inateck-bcst70', brand: 'Inateck', brandAr: 'إناتيك', model: 'BCST-70', category: 'barcode_scanner', connection: ['usb', 'bluetooth'], protocol: 'HID USB', supported: 'full', popular: true, saudiPopular: true, notesAr: 'اقتصادية وكثيرة الاستخدام' },
  { id: 'riotec-dc9300', brand: 'Riotec', brandAr: 'ريوتيك', model: 'DC9300', category: 'barcode_scanner', connection: ['usb'], protocol: 'HID USB', supported: 'full', popular: false },
  { id: 'netum-g5', brand: 'Netum', brandAr: 'نيتوم', model: 'G5', category: 'barcode_scanner', connection: ['usb', 'bluetooth'], protocol: 'HID USB', supported: 'full', popular: true },

  // ─────────────────────── CASH DRAWERS ───────────────────────
  { id: 'apg-vasario1616', brand: 'APG Cash Drawer', brandAr: 'APG', model: 'Vasario 1616', category: 'cash_drawer', connection: ['rj11'], protocol: 'ESC/POS (via printer)', supported: 'full', popular: true },
  { id: 'apg-vb490', brand: 'APG Cash Drawer', brandAr: 'APG', model: 'VB490', category: 'cash_drawer', connection: ['rj11'], protocol: 'ESC/POS (via printer)', supported: 'full', popular: false },
  { id: 'star-cd3', brand: 'Star Micronics', brandAr: 'ستار مايكرونكس', model: 'CD3-1616', category: 'cash_drawer', connection: ['rj11'], protocol: 'ESC/POS (via printer)', supported: 'full', popular: false },
  { id: 'posiflex-cr4000', brand: 'Posiflex', brandAr: 'بوسيفلكس', model: 'CR-4000', category: 'cash_drawer', connection: ['rj11'], protocol: 'ESC/POS (via printer)', supported: 'full', popular: false },
  { id: 'generic-rj11-drawer', brand: 'Generic', brandAr: 'جينريك', model: 'RJ11 Cash Drawer', category: 'cash_drawer', connection: ['rj11'], protocol: 'ESC/POS (via printer)', supported: 'full', popular: true, saudiPopular: true, notesAr: 'يعمل مع أي طابعة ESC/POS تدعم RJ11' },

  // ─────────────────────── CUSTOMER DISPLAYS ───────────────────────
  { id: 'epson-dmd110', brand: 'Epson', brandAr: 'إبسون', model: 'DM-D110', category: 'customer_display', connection: ['usb', 'serial'], protocol: 'ESC/POS', baudRate: 9600, supported: 'partial', popular: false },
  { id: 'epson-dmd210', brand: 'Epson', brandAr: 'إبسون', model: 'DM-D210', category: 'customer_display', connection: ['usb', 'lan'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.1.170', supported: 'partial', popular: false },
  { id: 'partner-cd7220', brand: 'Partner Tech', brandAr: 'بارتنر تك', model: 'CD-7220', category: 'customer_display', connection: ['serial', 'usb'], protocol: 'CDC/RS-232', baudRate: 9600, supported: 'partial', popular: false },
  { id: 'logic-ld9000', brand: 'Logic Controls', brandAr: 'لوجيك كونترولز', model: 'LD9000', category: 'customer_display', connection: ['serial', 'usb'], protocol: 'RS-232', baudRate: 9600, supported: 'partial', popular: false },
  { id: 'bixolon-bcd1000', brand: 'Bixolon', brandAr: 'بيكسولون', model: 'BCD-1000', category: 'customer_display', connection: ['serial', 'usb'], protocol: 'ESC/POS', baudRate: 9600, supported: 'partial', popular: false },

  // ─────────────────────── PAYMENT TERMINALS ───────────────────────
  { id: 'geidea-pos', brand: 'Geidea', brandAr: 'جيدية', model: 'Geidea POS', category: 'payment_terminal', connection: ['lan', 'wifi'], protocol: 'Geidea REST API', port: 443, defaultIp: 'api.geidea.net', supported: 'full', popular: true, saudiPopular: true, notesAr: 'متكامل بالكامل مع النظام ✅' },
  { id: 'verifone-v200c', brand: 'Verifone', brandAr: 'فيريفون', model: 'V200c Plus', category: 'payment_terminal', connection: ['lan', 'wifi'], protocol: 'Verifone REST', port: 443, defaultIp: '192.168.1.120', supported: 'partial', popular: false },
  { id: 'verifone-vx680', brand: 'Verifone', brandAr: 'فيريفون', model: 'VX680', category: 'payment_terminal', connection: ['wifi', 'bluetooth'], protocol: 'Verifone SDK', supported: 'partial', popular: false },
  { id: 'ingenico-move5000', brand: 'Ingenico', brandAr: 'إنجينيكو', model: 'Move 5000', category: 'payment_terminal', connection: ['wifi', 'bluetooth'], protocol: 'Ingenico SDK', supported: 'partial', popular: false },
  { id: 'ingenico-ipp350', brand: 'Ingenico', brandAr: 'إنجينيكو', model: 'iPP350', category: 'payment_terminal', connection: ['usb', 'serial'], protocol: 'Ingenico SDK', supported: 'partial', popular: false },
  { id: 'pax-s920', brand: 'PAX', brandAr: 'باكس', model: 'S920', category: 'payment_terminal', connection: ['wifi', 'bluetooth'], protocol: 'PAX SDK', supported: 'partial', popular: false, saudiPopular: true },
  { id: 'pax-a920-pay', brand: 'PAX', brandAr: 'باكس', model: 'A920 Pro', category: 'payment_terminal', connection: ['wifi', 'bluetooth'], protocol: 'PAX SDK', supported: 'partial', popular: false },
  { id: 'mada-tap', brand: 'Mada', brandAr: 'مدى', model: 'Tap on Phone', category: 'payment_terminal', connection: ['wifi', 'bluetooth'], protocol: 'Mada SDK', supported: 'partial', popular: true, saudiPopular: true, notesAr: 'الدفع السعودي الوطني' },

  // ─────────────────────── KDS SCREENS ───────────────────────
  { id: 'cloudsky-kds15', brand: 'CloudSky', brandAr: 'كلاود سكاي', model: 'KDS-15', category: 'kds_screen', connection: ['lan'], protocol: 'HTTP REST', port: 8080, defaultIp: '192.168.1.50', supported: 'full', popular: false },
  { id: 'epson-dmd30', brand: 'Epson', brandAr: 'إبسون', model: 'DM-D30', category: 'kds_screen', connection: ['usb', 'lan'], protocol: 'ESC/POS', port: 9100, defaultIp: '192.168.1.51', supported: 'partial', popular: false },
  { id: 'elo-15e2', brand: 'Elo Touch', brandAr: 'إيلو تاتش', model: 'I-Series 15E2', category: 'kds_screen', connection: ['lan', 'wifi'], protocol: 'HTTP REST / Android', defaultIp: '192.168.1.52', supported: 'partial', popular: false },
  { id: 'samsung-kds-32', brand: 'Samsung', brandAr: 'سامسونج', model: 'Smart TV 32" (KDS)', category: 'kds_screen', connection: ['lan', 'wifi'], protocol: 'HTTP REST', defaultIp: '192.168.1.53', supported: 'full', popular: true, saudiPopular: true, notesAr: 'أي شاشة ذكية بمتصفح' },

  // ─────────────────────── SCALES ───────────────────────
  { id: 'cas-sw20', brand: 'CAS', brandAr: 'CAS', model: 'SW-20', category: 'scale', connection: ['serial', 'usb'], protocol: 'RS-232', baudRate: 9600, supported: 'partial', popular: false },
  { id: 'mettler-toledo-jse', brand: 'Mettler Toledo', brandAr: 'ميتلر توليدو', model: 'JetScale JSE', category: 'scale', connection: ['serial', 'usb'], protocol: 'RS-232', baudRate: 9600, supported: 'partial', popular: false },
  { id: 'ohaus-ranger3000', brand: 'Ohaus', brandAr: 'أوهاوس', model: 'Ranger 3000', category: 'scale', connection: ['serial', 'usb'], protocol: 'RS-232', baudRate: 9600, supported: 'partial', popular: false },
  { id: 'digi-sm90', brand: 'Digi', brandAr: 'ديجي', model: 'SM-90', category: 'scale', connection: ['serial', 'usb'], protocol: 'RS-232', baudRate: 9600, supported: 'partial', popular: false },
];

export function getDevicesByCategory(cat: HardwareCategory): HardwareDevice[] {
  return HARDWARE_CATALOG.filter(d => d.category === cat);
}

export function getPopularDevices(): HardwareDevice[] {
  return HARDWARE_CATALOG.filter(d => d.popular);
}

export function getSaudiPopularDevices(): HardwareDevice[] {
  return HARDWARE_CATALOG.filter(d => d.saudiPopular);
}

export function searchDevices(query: string): HardwareDevice[] {
  const q = query.toLowerCase();
  return HARDWARE_CATALOG.filter(d =>
    d.brand.toLowerCase().includes(q) ||
    d.model.toLowerCase().includes(q) ||
    d.brandAr.includes(q) ||
    (d.protocol || '').toLowerCase().includes(q) ||
    (d.defaultIp || '').includes(q)
  );
}

export const CONNECTION_LABELS: Record<ConnectionType, { label: string; labelAr: string; color: string }> = {
  usb:       { label: 'USB', labelAr: 'USB', color: 'blue' },
  lan:       { label: 'LAN/IP', labelAr: 'شبكة IP', color: 'green' },
  serial:    { label: 'Serial', labelAr: 'سيريال', color: 'yellow' },
  bluetooth: { label: 'Bluetooth', labelAr: 'بلوتوث', color: 'indigo' },
  wifi:      { label: 'Wi-Fi', labelAr: 'واي فاي', color: 'cyan' },
  rs232:     { label: 'RS-232', labelAr: 'RS-232', color: 'orange' },
  rj11:      { label: 'RJ11', labelAr: 'RJ11 (طابعة)', color: 'pink' },
  cloud:     { label: 'Cloud', labelAr: 'سحابي', color: 'purple' },
};
