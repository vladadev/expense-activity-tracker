import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../Toast';
import { useSettings } from '../../context/SettingsContext';

// Saving, and the three endings it can have.
//
// Every form in this app repeated this by hand, and the middle ending is the
// one that gets forgotten: a write that got NO response has been accepted into
// the offline queue and IS going to be sent, so reporting a failure would be a
// lie and sending the person back to a form they already filled in would be
// worse. `err.queued` is set by the interceptor in api/client.js; see the
// offline-write notes.
//
// The third ending — a real error, with a response behind it — keeps the form
// open with its values intact and offers the retry on the toast, because the
// thing to do about "the server said no" is almost always "try that again".
export default function useFormSubmit({ run, success, navigation, errorMessage }) {
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();
  const { t } = useSettings();

  // goBack() unmounts this screen while the finally is still to come, and
  // setting state on the way out is a warning in the console and a leak in
  // the habit.
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  // The retry handed to the toast is this same function, which cannot name
  // itself inside its own definition.
  const self = useRef(null);

  const submit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await run();
      toast.success(success);
      navigation.goBack();
    } catch (err) {
      if (err.queued) {
        toast.success(t('toast.offline'));
        navigation.goBack();
        return;
      }
      toast.error(err.response?.data?.error || errorMessage, () => self.current?.());
    } finally {
      if (alive.current) setSubmitting(false);
    }
  }, [run, success, errorMessage, navigation, submitting, toast, t]);

  self.current = submit;

  return { submitting, submit };
}
