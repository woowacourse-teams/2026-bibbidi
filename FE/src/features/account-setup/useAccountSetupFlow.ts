import { useState } from "react";

import {
  clearAccountSetupChoice,
  readAccountSetupChoice,
  saveAccountSetupChoice,
  type AccountSetupChoice,
} from "./model/accountSetupChoice";
import { useLegacyAccountTransfer } from "./useLegacyAccountTransfer";
import { useNewAccountStart } from "./useNewAccountStart";

interface UseAccountSetupFlowOptions {
  onAuthenticationExpired: () => void;
  onSuccess: () => void;
  onTermsRequired: () => void;
}

export function useAccountSetupFlow({
  onAuthenticationExpired,
  onSuccess,
  onTermsRequired,
}: UseAccountSetupFlowOptions) {
  const [choice, setChoice] = useState(readAccountSetupChoice);
  const legacyAccount = useLegacyAccountTransfer({
    onAuthenticationExpired,
    onSuccess,
    onTermsRequired,
  });
  const newAccount = useNewAccountStart({
    onAuthenticationExpired,
    onSuccess,
  });
  const isSubmitting = legacyAccount.isSubmitting || newAccount.isSubmitting;

  const selectChoice = (nextChoice: AccountSetupChoice) => {
    if (isSubmitting) {
      return;
    }

    saveAccountSetupChoice(nextChoice);
    setChoice(nextChoice);
    legacyAccount.clearError();
    newAccount.clearError();
  };

  const returnToChoice = () => {
    if (isSubmitting) {
      return;
    }

    clearAccountSetupChoice();
    setChoice(undefined);
    legacyAccount.resetForm();
    newAccount.clearError();
  };

  return {
    choice,
    formError:
      choice === "legacy"
        ? legacyAccount.errorMessage
        : newAccount.errorMessage,
    isSubmitting,
    legacyValues: legacyAccount.values,
    returnToChoice,
    selectChoice,
    setLegacyFieldValue: legacyAccount.setFieldValue,
    submitLegacyAccount: legacyAccount.submit,
    submitNewAccount: newAccount.submit,
  };
}
