/** Subjects by field, covering the majors offered at most US universities. */
export const SUBJECT_GROUPS: { group: string; items: string[] }[] = [
  { group: 'Math and statistics', items: ['Precalculus', 'Calculus I', 'Calculus II', 'Multivariable calculus', 'Linear algebra', 'Differential equations', 'Discrete math', 'Proofs and logic', 'Real analysis', 'Abstract algebra', 'Complex analysis', 'Number theory', 'Topology', 'Numerical analysis', 'Probability', 'Statistics', 'Mathematical statistics', 'Regression and linear models', 'Stochastic processes', 'Actuarial science', 'Operations research', 'Financial mathematics'] },
  { group: 'Computing and data', items: ['Intro to programming', 'Data structures', 'Algorithms', 'Computer systems', 'Operating systems', 'Computer architecture', 'Databases', 'Networks', 'Software engineering', 'Theory of computation', 'Machine learning', 'Artificial intelligence', 'Data science', 'Cybersecurity', 'Information science', 'Web development', 'Human-computer interaction'] },
  { group: 'Engineering', items: ['Statics', 'Dynamics', 'Mechanics of materials', 'Thermodynamics', 'Fluid mechanics', 'Heat transfer', 'Circuits', 'Signals and systems', 'Electronics', 'Control systems', 'Digital logic', 'Electromagnetics', 'Materials science', 'Mechanical engineering', 'Electrical engineering', 'Civil engineering', 'Chemical engineering', 'Aerospace engineering', 'Biomedical engineering', 'Environmental engineering', 'Industrial engineering', 'Computer engineering', 'Nuclear engineering', 'Fire protection engineering'] },
  { group: 'Physical sciences', items: ['General chemistry', 'Organic chemistry', 'Physical chemistry', 'Analytical chemistry', 'Inorganic chemistry', 'Biochemistry', 'Physics I (mechanics)', 'Physics II (electricity and magnetism)', 'Modern physics', 'Quantum mechanics', 'Classical mechanics', 'Astronomy', 'Geology', 'Atmospheric science', 'Oceanography'] },
  { group: 'Life sciences and health', items: ['General biology', 'Cell biology', 'Molecular biology', 'Genetics', 'Microbiology', 'Ecology', 'Evolution', 'Physiology', 'Anatomy', 'Neuroscience', 'Immunology', 'Pharmacology', 'Nutrition', 'Kinesiology', 'Public health', 'Epidemiology', 'Nursing', 'Pre-med', 'Pre-dental', 'Pre-pharmacy', 'Animal science', 'Plant science'] },
  { group: 'Business', items: ['Financial accounting', 'Managerial accounting', 'Finance', 'Corporate finance', 'Investments', 'Marketing', 'Management', 'Operations management', 'Supply chain', 'Business analytics', 'Information systems', 'Entrepreneurship', 'Business law', 'Organizational behavior', 'Real estate', 'Hospitality'] },
  { group: 'Economics and social sciences', items: ['Microeconomics', 'Macroeconomics', 'Econometrics', 'Game theory', 'Psychology', 'Cognitive psychology', 'Developmental psychology', 'Abnormal psychology', 'Social psychology', 'Sociology', 'Anthropology', 'Political science', 'Government and politics', 'International relations', 'Public policy', 'Criminology', 'Geography', 'Urban studies', 'Communication', 'Journalism', 'Social work', 'Linguistics'] },
  { group: 'Humanities', items: ['English literature', 'Writing and composition', 'Rhetoric', 'Creative writing', 'Philosophy', 'Ethics', 'US history', 'World history', 'European history', 'Classics', 'Religious studies', "Women's and gender studies", 'African American studies', 'Asian American studies', 'Latin American studies', 'American studies', 'Art history'] },
  { group: 'Languages', items: ['Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Russian', 'Hebrew', 'Latin', 'Ancient Greek', 'American Sign Language'] },
  { group: 'Arts, design and media', items: ['Architecture', 'Graphic design', 'Studio art', 'Music theory', 'Music history', 'Theatre', 'Dance', 'Film studies', 'Photography', 'Digital media'] },
  { group: 'Education, law and more', items: ['Education', 'Special education', 'Early childhood education', 'Pre-law', 'Legal studies', 'Environmental science', 'Sustainability', 'Agricultural science', 'Library science', 'Military science'] },
];

export const ALL_SUBJECTS = SUBJECT_GROUPS.flatMap((g) => g.items);

/** Exams by type. College course exams come first. */
export const EXAM_GROUPS: { group: string; items: string[] }[] = [
  { group: 'College courses', items: ['Quiz', 'Midterm', 'Final exam', 'Problem set', 'Lab practical', 'Project or paper', 'Presentation', 'Oral exam'] },
  { group: 'Grad and professional school', items: ['GRE', 'GMAT', 'LSAT', 'MCAT', 'DAT', 'PCAT', 'OAT'] },
  { group: 'Licensing and careers', items: ['SOA Exam P (Probability)', 'SOA Exam FM (Financial Math)', 'SOA Exam FAM', 'SOA Exam SRM', 'CAS Exam MAS-I', 'CFA Level I', 'CPA', 'FE (Fundamentals of Engineering)', 'NCLEX', 'USMLE Step 1', 'Bar exam', 'Series 7', 'Technical interviews'] },
  { group: 'High school', items: ['AP', 'SAT', 'ACT', 'IB', 'A-Levels', 'IGCSE'] },
];

export const LEVELS = ['College', 'Community college', 'Graduate', 'Professional school', 'High school'];
