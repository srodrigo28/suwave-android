/**
 * Design tokens do app SUWAVE Motorista (nativo).
 *
 * Espelha as variaveis e valores definidos em
 * app/motorista/src/app/globals.css (`:root`, `.action`, `.field`, etc.).
 * Qualquer ajuste visual deve ser feito primeiro em app/motorista e depois
 * refletido aqui - ver app/docs/motorista-android.md.
 */

export const SuwaveColors = {
  background: '#ffffff',
  foreground: '#073449',
  ink: '#06384d',
  muted: '#61748a',
  line: '#d5e0e8',
  green: '#00875a',
  greenDark: '#00734d',
  greenSoft: '#e8f8ef',
  aqua: '#b9e1df',
  card: '#ffffff',

  yellow: '#ffc400',
  yellowText: '#ffb400',
  black: '#080808',

  inputBorder: '#d7d7d7',
  inputText: '#161616',
  placeholder: '#8a8a8a',
  link: '#f2bd00',
  secondaryActionBorder: '#111111',
} as const;

export const SuwaveRadii = {
  field: 8,
  action: 8,
} as const;

export const SuwaveSpacing = {
  screenHorizontal: 30,
  screenVerticalTop: 18,
  screenVerticalBottom: 24,
} as const;

export const SuwaveTypography = {
  // .suwaveLogoText / .suwaveLogoWave (clamp(46px, 13.2vw, 74px) na web)
  wordmarkFontSize: 58,
  // .suwaveLogoSub (clamp(15px, 4.2vw, 23px))
  wordmarkSubFontSize: 18,
  // .forgot-copy h1 (clamp(31px, 8vw, 43px))
  heroTitleFontSize: 34,
  // .forgot-copy p
  heroTextFontSize: 18,
  // .field input
  fieldFontSize: 18,
  // .login-screen .action
  actionFontSize: 20,
  actionSecondaryFontSize: 17,
  linkFontSize: 15,
} as const;

export const SuwaveAssets = {
  splash: require('../assets/images/motorista/splash.png'),
  loginHero: require('../assets/images/motorista/inicio-carro-cidade.png'),
  inicioLogo: require('../assets/images/motorista/inicio-logo.png'),
  inicioRodape: require('../assets/images/motorista/inicio-rodape.png'),
  faceValidationModel: require('../assets/images/motorista/face-validation-model.png'),
  submittedCar: require('../assets/images/motorista/cadastro-analise-carro.png'),
  workmodeCar: require('../assets/images/motorista/workmode2-car.png'),
  workmodeVan: require('../assets/images/motorista/workmode2-van.png'),
  workmodeMoto: require('../assets/images/motorista/workmode2-moto.png'),
  workmodeBike: require('../assets/images/motorista/workmode2-bike.png'),
} as const;
