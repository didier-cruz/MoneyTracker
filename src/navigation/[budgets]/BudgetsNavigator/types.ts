import {NativeStackNavigationProp} from '@react-navigation/native-stack';

export type BudgetsNavParams = {
  /** Raiz del stack; no puede llamarse `Budgets` porque asi se llama la
   * pestana que lo contiene (mismo motivo que `AccountsHome`). */
  BudgetsHome: undefined;
  CreateEnvelope: undefined;
  /** Same screen component as `CreateEnvelope`, in edit mode — see
   * `CreateEnvelope`'s doc comment. `kind` is never a param here: it is
   * not editable (see `useEnvelopeForm`/`updateEnvelope`'s own doc
   * comments), so there is nothing for a route param to carry beyond
   * which envelope to load. */
  EditEnvelope: {envelopeId: number};
};

export type BudgetsNavigationProp = NativeStackNavigationProp<
  BudgetsNavParams,
  'BudgetsHome'
>;

export type CreateEnvelopeNavigationProp = NativeStackNavigationProp<
  BudgetsNavParams,
  'CreateEnvelope'
>;

export type EditEnvelopeNavigationProp = NativeStackNavigationProp<
  BudgetsNavParams,
  'EditEnvelope'
>;
