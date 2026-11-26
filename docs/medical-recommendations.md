# Medical evidence review of preventive recommendations

## Conclusion and scope

The six implemented measures have a reasonable basis in discharge planning and
transitional care. **The evidence does not validate the complete HospitalCare
rule set, its model-based eligibility thresholds, or its cost categories.**
Education before discharge has direct guideline support. Early calls and visits
have support for relevant time windows, but the exact allocation by the model's
risk level is a project choice. The specialist referral and coordinator rules
require particular care when describing their thresholds and deadlines.

This is a focused narrative review of guidelines, original studies and dataset
definitions, not a systematic review or clinical approval. No application code,
API, database or recommendation rule was changed as part of this review.

## What the application actually does

- [Recommendation rules](../ml-service/readmission/recommend.py) run after a
  supported prediction. They are deterministic rules; the prediction model does
  not learn which intervention will help an individual patient.
- The current [model metadata](../ml-service/artifacts/model_meta.json) uses
  `low` for probability below 0.11, `medium` from 0.11 to below 0.23, and `high`
  from 0.23. [Training](../ml-service/train.py) derives these boundaries from the
  training-set readmission rate and twice that rate, rounded to two decimals.
  These are project thresholds, not medical guideline cutoffs.
- `deadline_days` is counted from discharge; `0` means before discharge. For a
  coordinator, this is the assignment deadline; the action separately describes
  30 days of support. The application proposes actions, but does not book visits,
  assign staff, or record their completion.
- `priority` repeats the patient's risk level. Within a prediction, recommendations
  are sorted by deadline, then by higher relative cost first for equal deadlines.
- [Prediction creation](../ml-service/app/main.py) stores the list with the
  prediction in [PostgreSQL](../ml-service/app/db.py). Unsupported predictions
  have no recommendations. Older records can also return an empty list through
  the compatibility handling in the [response schema](../ml-service/app/schemas.py).
  An empty list does not establish that preventive care is unnecessary.

## Evidence mapped to the six implemented rules

The assessments below distinguish support for an **action** from validation of
its **exact selection rule**. They are review conclusions, not formal GRADE ratings.

| Measure / code | Implemented eligibility | Implemented timing | Evidence and assessment |
|---|---|---|---|
| Discharge education / `discharge_education` | Every new supported prediction, including low risk. | Before discharge. | **Action and timing supported for the relevant adult population.** Endocrine Society recommendation 4.1 includes inpatient education within discharge planning. It is not conditional on HospitalCare's score. [Endocrine Society 2022][ENDO22] |
| Nurse call / `follow_up_call` | Medium or high model risk. | Within 3 days for medium risk; 2 days for high risk. | **Time window supported; risk split is heuristic.** AHRQ RED Tool 5 specifies contact 2–3 days after discharge, covering symptoms/status, medicines and follow-up arrangements. It applies to RED patients, not to this model's risk categories. [AHRQ RED][RED5] |
| Outpatient review / `follow_up_visit` | Medium or high model risk. | Within 14 days for medium risk; 7 days for high risk. | **Partially supported.** ADA describes follow-up within a month after inpatient dysglycemia, preferably 1–2 weeks if glucose management is not satisfactory or therapy changes. The 7/14-day interval is compatible with earlier review, but model risk alone is a different eligibility rule. [ADA 2026][ADA26] |
| Pharmacist medication review / `medication_review` | Medium/high risk **and** either an antidiabetic medication change or `num_medications >= 20`. | Before discharge. | **Action supported; exact filter unvalidated.** NICE supports considering structured review for polypharmacy/chronic conditions and selecting a suitably skilled professional. It does not establish this 20-drug/model-risk rule. [NICE NG5, 1.4.1–1.4.3][NICE5] |
| Diabetes specialist / `diabetes_specialist` | Any risk with category `A1Cresult == ">8"` **or** `max_glu_serum == ">300"`; otherwise medium/high risk with `">7"` **or** `">200"`, respectively. | Within 14 days for high risk; otherwise 30 days. | **Clinical rationale supported; combined rule and deadlines need qualification.** Glycemia-informed discharge treatment has been studied, but that does not validate automatic referral using these categories. A 30-day deadline can be too late for the earlier-review circumstances above; see the timing concern below. [Umpierrez et al. 2014][UMPIERREZ14], [ADA 2026][ADA26] |
| Care coordinator / `care_coordinator` | High model risk **and** (`number_inpatient >= 2` **or** `number_emergency >= 2`) in the preceding year. One of each does **not** satisfy the rule. | Assign before discharge; support for 30 days. | **Program concept supported; targeting and duration are project adaptations.** A trial supports transitional coaching in selected older adults, not this eligibility rule or an optimal 30-day duration for every patient. [Coleman et al. 2006][CTI06] |

### What education and medication review mean

Education should address practical self-management and access to needed medicines
and supplies, rather than only handing out a leaflet. The Endocrine Society
recommendation concerns adults hospitalized for non-critical illness; specialist
educators are preferred, with trained staff supported where resources are limited.
[Endocrine Society 2022, recommendation 4.1 and remarks][ENDO22]

A structured medication review is distinct from reconciliation of the medication
list at a care transition. The code's targeted pharmacist review must not be
interpreted as a reason to omit routine reconciliation for low-risk patients.
NICE allows the review to be led by an appropriate trained professional, not
necessarily a pharmacist in every setting. [NICE NG5, sections 1.2–1.4][NICE5],
[AHRQ RED Tool 5, medicine-list checks][RED5]

### Timing concern: specialist review at 30 days

The code can give a low-risk patient with category `">8"` or `">300"` only
education and a specialist review within 30 days. The separate 7/14-day visit
rule does not apply at low risk. If glucose management remains unsatisfactory at
discharge, a low readmission score does not remove the need for earlier review.
For medium/high risk, the separate outpatient visit may provide an earlier
assessment even when the specialist deadline is 30 days. This is an interpretation
of the code against ADA's follow-up advice, not proof that every 30-day referral
is inappropriate. [ADA 2026, hospital-to-ambulatory transition section][ADA26]

The HbA1c-based discharge study used categories below 7%, 7–9%, and above 9% to
guide treatment in adults with type 2 diabetes. Its main outcome was HbA1c at
12 weeks, not validation of a specialist referral deadline or this application's
7%/8% triggers. Its thresholds should not be substituted into the code without a
separate clinical review. [Umpierrez et al. 2014, methods and abstract][UMPIERREZ14]

These deadlines describe planned follow-up, not permission to wait during acute
deterioration. AHRQ's call process includes escalation when a patient's condition
worsens. [AHRQ RED Tool 5, health-status assessment][RED5]

## Thresholds, data and cost limitations

| Item | What can be concluded |
|---|---|
| Model risk boundaries | The current 0.11/0.23 values come from the training procedure. Neither discrimination metrics nor a patient's risk category establish which intervention will work or its optimal timing. No direct clinical validation of this complete allocation policy was identified in the reviewed sources. |
| Twenty medicines | UCI defines `num_medications` as the count of distinct generic names administered during the encounter. It is not a count of medicines taken simultaneously at home or prescribed at discharge. The value 20 is a project trigger, not a threshold supplied by the reviewed medication-review guideline. [UCI dataset][UCI], [NICE NG5][NICE5] |
| Two prior encounters | The application checks the inpatient and emergency counts separately. The reviewed transition-care studies do not establish this particular cutoff as the criterion for its coordinator action. [Coleman et al. 2006][CTI06], [DiaTOHC 2022][DIATOHC22] |
| Laboratory categories | The API accepts categorical tokens, not raw numeric laboratory measurements. The original dataset distinguishes the HbA1c bins and a not-measured category. These do not describe symptoms, measurement time or glucose status at discharge. Do not treat `none` as normal; confirm laboratory units before mapping current measurements, since the service performs no unit conversion. [Strack et al. 2014, Table 1][STRACK14] |
| Medication change | The source data describe inpatient changes; the original study could not track preadmission and discharge medication lists. A change flag is therefore a prompt to review the actual plan, not a complete reconciliation. [Strack et al. 2014, section 2.3][STRACK14] |
| Relative cost | `low` = education/call, `medium` = visit/review/specialist, `high` = coordinator. These are manually assigned resource categories, not prices, reimbursement tariffs or measured cost-effectiveness. No Slovak staffing/tariff calculation is implemented. Studies of whole programs cannot validate this ranking or the cost-first tie-break. [Coleman et al. 2006][CTI06], [DiaTOHC 2022][DIATOHC22] |

The source dataset contains US encounters from 1999–2008. That context differs
from contemporary Slovak practice. Adult guidelines and trials in selected
populations do not establish suitability for every age accepted by the API,
including children, or for every discharge destination. These limitations require
local clinical review before treating the output as a care protocol.
[UCI dataset][UCI], [Endocrine Society 2022][ENDO22], [Coleman et al. 2006][CTI06]

## What can be claimed about effectiveness

- **Coleman trial:** in 750 adults aged at least 65, 30-day readmission was 8.3%
  versus 11.9% (`P = .048` adjusted; `.11` unadjusted). It tested a bundled
  intervention, not HospitalCare's coordinator rule. [Coleman et al. 2006, Table 3][CTI06]
- **DiaTOHC pilot:** 93 adults were randomized and 91 analyzed; 30-day readmission
  was 31.1% versus 32.6%. Support included a call at 1–3 days and weekly calls for
  four weeks. The trial was not powered to establish efficacy and performed no
  outcome hypothesis testing. Eligibility used DERRI risk of at least 27%, not
  HospitalCare's model. This is a relevant care model, not proof of the six rules.
  [DiaTOHC 2022, sections 2.2–2.5 and 3.3][DIATOHC22]
- **Project plots:** `recommendation_summary()` applies the rules to held-out
  records and reports recipient counts and their observed readmission rate.
  `reports/recommendations.png` and `test_recommendations` in model metadata are
  descriptive selection analyses. No intervention was assigned or tested, so
  these outputs cannot demonstrate prevented readmissions, savings, or causal
  benefit from a particular measure.

Suggested wording for the report:

> HospitalCare combines readmission risk prediction with a rule-based set of
> follow-up suggestions informed by discharge-planning guidance and transition-care
> studies. The underlying care actions have published support, while exact model
> thresholds, eligibility filters, cost categories and some deadlines are project
> assumptions. Their clinical effectiveness has not been established by the
> retrospective model evaluation. The treating clinician must individualize care.

## Sources and exact places to check

All sources were checked for this review on 22 November 2026. References are
guidelines, original studies or the dataset's own documentation. Bibliographic
year, recommendation number and section are provided so they can be cited in the
team's report without citing this review as medical authority.

1. **ADA Professional Practice Committee (2026).** Hospital care, Standards of
   Care in Diabetes, section 16. *Diabetes Care* 49(Suppl. 1):S339–S355.
   DOI: **10.2337/dc26-S016**. Check recommendation **16.18** and the subsequent
   hospital-to-ambulatory transition discussion, especially **S350** for follow-up
   timing. [Full article][ADA26]; [ADA's abridged section](https://doi.org/10.2337/doc26-a016)
   repeats the follow-up advice. Guideline, not a trial of HospitalCare.
2. **Korytkowski MT et al. (2022).** Endocrine Society guideline on inpatient
   hyperglycemia. *JCEM* 107(8):2101–2128. DOI:
   **10.1210/clinem/dgac278**. Check **recommendation 4.1 and its remarks** for
   education as part of discharge planning. [Official recommendation text][ENDO22].
3. **AHRQ (2013; page reviewed March 2025).** RED Toolkit, **Tool 5**. Check the
   purpose, call timing, medicine-list checks and health-status assessment.
   [Official toolkit chapter][RED5]. Implementation guidance, not validation of a
   risk-based 2-day/3-day split.
4. **NICE (2015).** Medicines optimisation, **NG5**. Check **sections 1.2–1.3** on
   transfers/reconciliation and **1.4.1–1.4.3** on review eligibility, professional
   skills and review content. [Official recommendations][NICE5]. The text was
   also checked in the [UK Government Web Archive capture](https://tnaqa.mirrorweb.com/ukgwa/20261102132827mp_/https%3A/www.nice.org.uk/guidance/ng5/chapter/recommendations).
5. **Coleman EA, Parry C, Chalmers S, Min SJ (2006).** Care Transitions Intervention
   randomized trial. *Archives of Internal Medicine* 166:1822–1828.
   DOI: **10.1001/archinte.166.17.1822**. Check **methods and Tables 1, 3 and 4**
   for the intervention, population, outcomes and program costs.
   [Original publication][CTI06].
6. **Rubin DJ et al. (2022).** DiaTOHC pilot randomized trial. *Journal of Clinical
   Medicine* 11(6):1471. DOI: **10.3390/jcm11061471**. Check **2.2**, **2.3.3**,
   **2.4–2.5**, **3.3** and the discussion for eligibility, calls, pilot limitations
   and results. [Original full text][DIATOHC22].
7. **Umpierrez GE et al. (2014).** Admission-HbA1c-based discharge algorithm for
   type 2 diabetes. *Diabetes Care* 37:2934–2939. DOI:
   **10.2337/dc14-0479**. Check **abstract/methods** for treatment categories and
   the primary outcome. [Publication record and abstract][UMPIERREZ14].
8. **Strack B et al. (2014).** HbA1c measurement and readmission database study.
   *BioMed Research International* 2014:781670. DOI: **10.1155/2014/781670**.
   Check **Table 1 and section 2.3** for field meanings and medication-data
   limitations. [Original full text][STRACK14]. Observational data definitions do
   not establish intervention efficacy.
9. **Clore J, Cios K, DeShazo J, Strack B (2014).** Diabetes 130-US Hospitals,
   1999–2008. UCI dataset. DOI: **10.24432/C5230J**. Check the dataset context
   and variable definitions. [Dataset documentation][UCI].

[ADA26]: https://doi.org/10.2337/dc26-S016
[ENDO22]: https://www.endocrine.org/clinical-practice-guidelines/inpatient-hyperglycemia-guideline-resources
[RED5]: https://www.ahrq.gov/patient-safety/settings/hospital/red/toolkit/redtool5.html
[NICE5]: https://www.nice.org.uk/guidance/ng5/chapter/recommendations#medication-review
[CTI06]: https://jamanetwork.com/journals/jamainternalmedicine/fullarticle/410933
[DIATOHC22]: https://www.mdpi.com/2077-0383/11/6/1471
[UMPIERREZ14]: https://pubmed.ncbi.nlm.nih.gov/25168125/
[STRACK14]: https://pmc.ncbi.nlm.nih.gov/articles/PMC3996476/
[UCI]: https://archive.ics.uci.edu/dataset/296/diabetes+130-us+hospitals+for+years+1999-2008
