import { doseLabels } from '../../shared/format';

const factorLabels: Record<string, string> = {
  age: 'Vek',
  gender: 'Pohlavie',
  admission_type_id: 'Typ prijatia',
  discharge_disposition_id: 'Spôsob prepustenia',
  admission_source_id: 'Zdroj prijatia',
  medical_specialty: 'Špecializácia ošetrujúceho lekára',
  time_in_hospital: 'Dĺžka pobytu (dni)',
  num_lab_procedures: 'Počet laboratórnych vyšetrení',
  num_procedures: 'Počet výkonov',
  num_medications: 'Počet liekov',
  number_outpatient: 'Ambulantné návštevy v roku pred prijatím',
  number_emergency: 'Urgentné návštevy v roku pred prijatím',
  number_inpatient: 'Hospitalizácie v roku pred prijatím',
  number_diagnoses: 'Počet diagnóz',
  diag_1: 'Hlavná diagnóza',
  diag_2: 'Druhá diagnóza',
  diag_3: 'Tretia diagnóza',
  max_glu_serum: 'Glykémia',
  a1c_result: 'HbA1c',
  A1Cresult: 'HbA1c',
  change: 'Zmena diabetickej liečby',
  diabetes_med: 'Antidiabetická liečba',
  diabetesMed: 'Antidiabetická liečba',
};

const medicationLabels: Record<string, string> = {
  metformin: 'Metformín',
  repaglinide: 'Repaglinid',
  nateglinide: 'Nateglinid',
  glimepiride: 'Glimepirid',
  glipizide: 'Glipizid',
  glyburide: 'Glibenklamid',
  pioglitazone: 'Pioglitazón',
  rosiglitazone: 'Rosiglitazón',
  acarbose: 'Akarbóza',
  insulin: 'Inzulín',
  glyburide_metformin: 'Glibenklamid a metformín',
};

const medicationKey = (field: string) => field.replace(/^medications\./, '').replaceAll('-', '_');

export function predictionFactorLabel(field: string): string {
  const medication = medicationLabels[medicationKey(field)];
  return factorLabels[field] ?? (medication ? `Liek: ${medication}` : 'Ďalší faktor');
}

export function predictionFactorValue(
  field: string,
  value: string | number | boolean | null,
): string {
  if (value == null || value === '') return 'Neuvedené';
  if (typeof value === 'boolean') return value ? 'Áno' : 'Nie';
  if (typeof value === 'number') return new Intl.NumberFormat('sk-SK').format(value);

  const normalized = value.toLowerCase();
  if (medicationLabels[medicationKey(field)]) {
    const status = Object.entries(doseLabels).find(([key]) => key.toLowerCase() === normalized);
    if (status) return status[1];
  }
  if (field === 'gender') {
    if (normalized === 'male' || normalized === 'm') return 'Muž';
    if (normalized === 'female' || normalized === 'f') return 'Žena';
  }
  if (['change', 'diabetes_med', 'diabetesMed'].includes(field)) {
    if (['yes', 'true', '1', 'ch'].includes(normalized)) return 'Áno';
    if (['no', 'false', '0'].includes(normalized)) return 'Nie';
  }
  if (['max_glu_serum', 'a1c_result', 'A1Cresult'].includes(field)) {
    if (normalized === 'none') return 'Nevykonané';
    if (normalized === 'norm') return 'V norme';
  }
  if (normalized === 'unknown') return 'Neuvedené';
  return value;
}

export interface PredictionRecommendation {
  code: string;
  action: string;
  priority: string;
  deadline_days: number;
  cost: string;
  triggers: string[];
  reason: string;
}

const recommendationActions: Record<string, string> = {
  care_coordinator:
    'Prideliť koordinátora starostlivosti na 30 dní po prepustení (domáca návšteva, termíny, sociálna podpora)',
  follow_up_visit: 'Objednať kontrolu u ošetrujúceho lekára',
  medication_review: 'Kontrola zoznamu liekov farmaceutom pred prepustením',
  diabetes_specialist: 'Odoslať k diabetológovi na úpravu liečby',
  follow_up_call: 'Telefonický kontakt sestry: príznaky, glykémia a užívanie liekov',
  discharge_education: 'Poučenie pri prepustení a edukácia o starostlivosti pri diabete',
};

const recommendationTriggers: Record<string, string> = {
  high_risk: 'vysoké riziko opätovnej hospitalizácie',
  medium_risk: 'stredné riziko opätovnej hospitalizácie',
  frequent_admissions: '2 a viac hospitalizácií v roku pred prijatím',
  frequent_emergency: '2 a viac urgentných návštev v roku pred prijatím',
  poor_glucose_control: 'výrazne zvýšený HbA1c alebo glykémia',
  elevated_glucose: 'zvýšený HbA1c alebo glykémia',
  medication_change: 'zmena antidiabetickej liečby počas hospitalizácie',
  many_medications: '20 a viac liekov počas hospitalizácie',
};

const costLabels: Record<string, string> = {
  low: 'nízke náklady',
  medium: 'stredné náklady',
  high: 'vysoké náklady',
};

export function recommendationAction(recommendation: PredictionRecommendation): string {
  return recommendationActions[recommendation.code] ?? recommendation.action;
}

export function recommendationDetails(recommendation: PredictionRecommendation): string {
  const deadline =
    recommendation.deadline_days === 0 ? 'Pred prepustením' : `Do ${recommendation.deadline_days} dní`;
  return `${deadline} · ${costLabels[recommendation.cost] ?? recommendation.cost}`;
}

export function recommendationReason(recommendation: PredictionRecommendation): string {
  if (recommendation.code === 'discharge_education') return 'Odporúča sa každému pacientovi pri prepustení.';
  const reasons = recommendation.triggers
    .map((trigger) => recommendationTriggers[trigger])
    .filter(Boolean);
  if (!reasons.length) return '';
  const text = reasons.join(', ');
  return `Dôvod: ${text}.`;
}

interface PredictionReason {
  field: string;
  code: string;
}

export function predictionReasons(reasons?: PredictionReason[]): string {
  return (
    reasons
      ?.map((reason) => {
        const field = predictionFactorLabel(reason.field);
        switch (reason.code) {
          case 'excluded_discharge':
            return 'Pri úmrtí pacienta alebo prepustení do hospicu sa riziko opätovnej hospitalizácie nepočíta.';
          case 'unknown_code':
            return `Kód v poli „${field}“ sa nenachádza v údajoch použitých na trénovanie modelu.`;
          case 'out_of_range':
            return `Hodnota v poli „${field}“ je mimo rozsahu údajov použitých na trénovanie modelu.`;
          default:
            return 'Predikciu nie je možné vypočítať pre zadané údaje.';
        }
      })
      .join(' ') || 'Predikciu nie je možné vypočítať pre zadané údaje.'
  );
}

const validationMessages: Record<string, string> = {
  'Patient date of birth is missing.': 'Chýba dátum narodenia pacienta.',
  'Patient gender is missing.': 'Chýba pohlavie pacienta.',
  'AdmissionTypeId is missing.': 'Chýba kód typu prijatia.',
  'DischargeDispositionId is missing.': 'Chýba kód spôsobu prepustenia.',
  'TimeInHospital must be greater than zero.': 'Dĺžka pobytu musí byť väčšia ako nula.',
  'Primary diagnosis is missing.': 'Chýba hlavná diagnóza.',
  'NumLabProcedures is missing.': 'Chýba počet laboratórnych vyšetrení.',
  'NumProcedures is missing.': 'Chýba počet výkonov.',
  'NumMedications is missing.': 'Chýba počet liekov.',
  'NumberDiagnoses is missing.': 'Chýba počet diagnóz.',
  'NumberOutpatient is missing.': 'Chýba počet ambulantných návštev v roku pred prijatím.',
  'NumberEmergency is missing.': 'Chýba počet urgentných návštev v roku pred prijatím.',
  'NumberInpatient is missing.': 'Chýba počet hospitalizácií v roku pred prijatím.',
  'Date of birth is after admission date.': 'Dátum narodenia nemôže byť po dátume prijatia.',
  'Unsupported patient gender.': 'Zadané pohlavie pacienta nie je podporované modelom.',
};

export function predictionRequestError(status: number, message?: string): string {
  if (status === 400) {
    const translated = Object.entries(validationMessages)
      .filter(([original]) => message?.includes(original))
      .map(([, translation]) => translation);
    if (translated.length) return translated.join(' ');
    return 'Skontrolujte údaje pacienta, hospitalizácie a liekov.';
  }
  if (status === 401) return 'Relácia vypršala. Prihláste sa znova.';
  if (status === 403) return 'Na túto akciu nemáte oprávnenie.';
  if (status === 404) return 'Požadovaná hospitalizácia alebo predikcia sa nenašla.';
  if (status === 422)
    return 'Predikčná služba neprijala zadané údaje. Skontrolujte vyplnené polia.';
  if (status === 429) return 'Príliš veľa pokusov. Skúste to znova neskôr.';
  if (status === 502 || status === 503) return 'Predikčná služba momentálne nie je dostupná.';
  if (status === 504) return 'Výpočet predikcie trval príliš dlho. Skúste to znova.';
  return 'Predikciu sa nepodarilo spracovať. Skúste to znova neskôr.';
}
