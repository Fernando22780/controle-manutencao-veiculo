let pickerInProgress = false;
let pickerWasBackgrounded = false;

export function beginPhotoPickerActivity() {
  pickerInProgress = true;
  pickerWasBackgrounded = false;
}

export function endPhotoPickerActivity() {
  if (!pickerWasBackgrounded) pickerInProgress = false;
}

export function trackPhotoPickerAppState(nextState) {
  if (!pickerInProgress) return false;
  if (nextState === 'background') {
    pickerWasBackgrounded = true;
    return false;
  }
  if (nextState === 'active' && pickerWasBackgrounded) {
    pickerInProgress = false;
    pickerWasBackgrounded = false;
    return true;
  }
  return false;
}
