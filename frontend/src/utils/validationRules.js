export function requiredRule(label) {
  return value => (value !== null && value !== undefined && String(value).trim() !== '') || `${label}: campo obligatorio.`
}

export function lengthRule(label, minimum, maximum) {
  return value => {
    const length = String(value ?? '').length
    return (length >= minimum && length <= maximum) || `${label} debe tener entre ${minimum} y ${maximum} caracteres.`
  }
}

export function integerRangeRule(label, minimum, maximum) {
  return value => {
    const number = Number(value)
    return (Number.isInteger(number) && number >= minimum && number <= maximum)
      || `${label} debe ser un número entero entre ${minimum} y ${maximum}.`
  }
}

export function optionalIntegerRangeRule(label, minimum, maximum) {
  return value => value === '' || value === null || value === undefined || integerRangeRule(label, minimum, maximum)(value)
}
