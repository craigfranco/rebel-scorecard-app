// Real hotel data from Rebel Deployment app
export const HOTELS = [
  { name: "nyma The New York Manhattan Hotel", parent_brand: "Independent", sub_brand: "Independent", city: "New York", state: "NY", gm_name: "Axel Fischer" },
  { name: "Sheraton Orlando North Hotel", parent_brand: "Marriott", sub_brand: "Sheraton", city: "Maitland", state: "FL", gm_name: "Raluca Avacaritei" },
  { name: "Ink 48 Hotel", parent_brand: "Independent", sub_brand: "Independent", city: "New York", state: "NY", gm_name: "Craig Kepple" },
  { name: "Residence Inn Riverside Moreno Valley", parent_brand: "Marriott", sub_brand: "Residence Inn", city: "Moreno Valley", state: "CA", gm_name: "Swami Eichner" },
  { name: "Hyatt Regency Milwaukee", parent_brand: "Hyatt", sub_brand: "Hyatt Regency", city: "Milwaukee", state: "WI", gm_name: "Mat Meadows" },
  { name: "Smyth Tribeca", parent_brand: "Independent", sub_brand: "Preferred Hotels", city: "New York", state: "NY", gm_name: "Aldo Garcia" },
  { name: "Life Hotel New York", parent_brand: "Independent", sub_brand: "Independent", city: "New York", state: "NY", gm_name: "Axel Fischer" },
  { name: "The Renwick", parent_brand: "Independent", sub_brand: "Independent", city: "New York", state: "NY", gm_name: "Oumar Kane" },
  { name: "DoubleTree by Hilton Somerset Hotel and Conference Center", parent_brand: "Hilton", sub_brand: "DoubleTree", city: "Somerset", state: "NJ", gm_name: "Amr Saad" },
  { name: "Hotel at Times Square", parent_brand: "Independent", sub_brand: "Independent", city: "New York", state: "NY", gm_name: "Raluca Avacaritei" },
  { name: "El Encanto Santa Barbara", parent_brand: "Independent", sub_brand: "Leading Hotels", city: "Santa Barbara", state: "CA", gm_name: "Gary Obligacion" },
  { name: "Courtyard by Marriott Los Angeles Pasadena/Monrovia", parent_brand: "Marriott", sub_brand: "Courtyard", city: "Monrovia", state: "CA", gm_name: "Joseph Valencia" },
  { name: "Delta Hotels Woodbridge", parent_brand: "Marriott", sub_brand: "Delta", city: "Woodbridge", state: "NJ", gm_name: "Eric Gonzalez" },
  { name: "Fairfield Inn & Suites Fresno Clovis", parent_brand: "Marriott", sub_brand: "Fairfield", city: "Clovis", state: "CA", gm_name: "Kenneth Guereque" },
  { name: "Holiday Inn Express & Suites Moreno Valley", parent_brand: "IHG", sub_brand: "Holiday Inn Express", city: "Moreno Valley", state: "CA", gm_name: "Ashley Tinajero" },
  { name: "Hyatt Place Riverside Downtown", parent_brand: "Hyatt", sub_brand: "Hyatt Place", city: "Riverside", state: "CA", gm_name: "Open Position" },
  { name: "Aura Hotel Times Square", parent_brand: "Independent", sub_brand: "Independent", city: "New York", state: "NY", gm_name: "Karolina Trimboli" },
  { name: "Hilton Washington DC Capitol Hill", parent_brand: "Hilton", sub_brand: "Hilton", city: "Washington", state: "DC", gm_name: "Stacy Smith" },
  { name: "Four Points by Sheraton Los Angeles Westside", parent_brand: "Marriott", sub_brand: "Four Points", city: "Culver City", state: "CA", gm_name: "Adey Adewinmbi" },
  { name: "Domain Hotel Sunnyvale", parent_brand: "Independent", sub_brand: "Independent", city: "Sunnyvale", state: "CA", gm_name: "Ram Morad" },
  { name: "Hotel at Fifth Avenue", parent_brand: "Independent", sub_brand: "Independent", city: "New York", state: "NY", gm_name: "Axel Fischer" },
  { name: "Hilton East Brunswick Hotel & Executive Meeting Center", parent_brand: "Hilton", sub_brand: "Hilton", city: "East Brunswick", state: "NJ", gm_name: "Amr Saad" },
  { name: "Comfort Suites Clovis", parent_brand: "Choice", sub_brand: "Comfort Inn", city: "Clovis", state: "CA", gm_name: "Irene Ramirez" },
  { name: "Fairfield Inn & Suites Indio Coachella Valley", parent_brand: "Marriott", sub_brand: "Fairfield", city: "Indio", state: "CA", gm_name: "Adilene Guzman" },
  { name: "Hilton San Diego Del Mar", parent_brand: "Hilton", sub_brand: "Hilton", city: "Del Mar", state: "CA", gm_name: "Greg Schmidt" },
];

export function getGssForBrand(parentBrand) {
  const map = {
    Marriott: { gss_metric: 'ITR', gss_target: 1.0 },
    Hilton: { gss_metric: 'Stay Score', gss_target: 1.0 },
    IHG: { gss_metric: 'Overall Experience', gss_target: 1.0 },
    Hyatt: { gss_metric: 'Perf Tier', gss_target: 1.0 },
    Choice: { gss_metric: 'Choice Likelihood', gss_target: 0.3 },
    Independent: { gss_metric: 'Revinate', gss_target: 0.03 },
  };
  return map[parentBrand] || map['Independent'];
}