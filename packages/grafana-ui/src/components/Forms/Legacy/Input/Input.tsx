import classNames from 'classnames';
import { PureComponent, ChangeEvent } from 'react';
import * as React from 'react';

import { ValidationEvents, ValidationRule } from '../../../../types/input';
import { validate, EventsWithValidation, hasValidationEvent } from '../../../../utils/validate';

/** @deprecated Please use the `Input` component, which does not require this enum. */
export enum LegacyInputStatus {
  Invalid = 'invalid',
  Valid = 'valid',
}

export interface Props extends React.HTMLProps<HTMLInputElement> {
  validationEvents?: ValidationEvents;
  hideErrorMessage?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  // Override event props and append status as argument
  onBlur?: (event: React.FocusEvent<HTMLInputElement>, status?: LegacyInputStatus) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>, status?: LegacyInputStatus) => void;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>, status?: LegacyInputStatus) => void;
}

interface State {
  error: string | null;
}

/** @deprecated Please use the `Input` component. {@link https://developers.grafana.com/ui/latest/index.html?path=/story/forms-input--simple See Storybook for example.} */
export class Input extends PureComponent<Props, State> {
  static defaultProps = {
    className: '',
  };

  state: State = {
    error: null,
  };

  get status() {
    return this.state.error ? LegacyInputStatus.Invalid : LegacyInputStatus.Valid;
  }

  get isInvalid() {
    return this.status === LegacyInputStatus.Invalid;
  }

  validatorAsync = (validationRules: ValidationRule[]) => {
    return (evt: ChangeEvent<HTMLInputElement>) => {
      const errors = validate(evt.target.value, validationRules);
      this.setState((prevState) => {
        return { ...prevState, error: errors ? errors[0] : null };
      });
    };
  };

  // Code Smell 2: Any Type
  // Removido o uso de any no parâmetro restProps.
  // restProps representa as props restantes do input (event handlers, etc.).
  // Usei Partial<Props> para capturar essas propriedades de forma mais segura
  // e tratar chamadas dinâmicas de eventos com checagens de tipo em tempo de execução.
  populateEventPropsWithStatus = (
    restProps: Partial<Props>,
    validationEvents: ValidationEvents | undefined
  ) => {
    const inputElementProps = { ...(restProps as Partial<Props>) };
    if (!validationEvents) {
      return inputElementProps;
    }
    Object.keys(EventsWithValidation).forEach((eventName) => {
      const hasValidation = hasValidationEvent(eventName as EventsWithValidation, validationEvents);
      const originalHandler = (restProps as Record<string, unknown>)[eventName];
      const shouldAttach = hasValidation || typeof originalHandler === 'function';
      if (shouldAttach) {
        inputElementProps[eventName as keyof typeof inputElementProps] = async (
          evt: ChangeEvent<HTMLInputElement>
        ) => {
          evt.persist(); // Needed for async. https://reactjs.org/docs/events.html#event-pooling
          if (hasValidation) {
            // validationEvents[eventName] exists by contract when hasValidation is true
            await this.validatorAsync((validationEvents as ValidationEvents)[eventName]).apply(this, [evt]);
          }
          if (typeof originalHandler === 'function') {
            // originalHandler is a function, invoke it with event and status
            (originalHandler as Function).apply(null, [evt, this.status]);
          }
        };
      }
    });
    return inputElementProps;
  };

  render() {
    const { validationEvents, className, hideErrorMessage, inputRef, ...restProps } = this.props;
    const { error } = this.state;
    const inputClassName = classNames('gf-form-input', { invalid: this.isInvalid }, className);
    const inputElementProps = this.populateEventPropsWithStatus(restProps, validationEvents);

    return (
      <div style={{ flexGrow: 1 }}>
        <input {...inputElementProps} ref={inputRef} className={inputClassName} />
        {error && !hideErrorMessage && <span>{error}</span>}
      </div>
    );
  }
}
