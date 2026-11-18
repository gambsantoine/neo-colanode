import { useForm } from '@tanstack/react-form';
import { Mail } from 'lucide-react';
import { useRef } from 'react';
import { z } from 'zod/v4';

import {
  isValidUsername,
  normalizeUsername,
  suggestUsername,
} from '@colanode/core';
import { Button } from '@colanode/ui/components/ui/button';
import {
  Field,
  FieldError,
  FieldLabel,
} from '@colanode/ui/components/ui/field';
import { Input } from '@colanode/ui/components/ui/input';
import { Spinner } from '@colanode/ui/components/ui/spinner';

const formSchema = z
  .object({
    name: z.string().min(2),
    username: z.string().transform(normalizeUsername).refine(isValidUsername, {
      message:
        'Use 3 to 32 lowercase letters, digits, dots, dashes or underscores.',
    }),
    email: z.string().min(2).email(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(
        /[^A-Za-z0-9]/,
        'Password must contain at least one special character'
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'], // path of error
  });

interface RegisterFormProps {
  isPending: boolean;
  onSubmit: (values: z.infer<typeof formSchema>) => void;
}

export const RegisterForm = ({ isPending, onSubmit }: RegisterFormProps) => {
  // The username follows the name until the user edits it.
  const usernameEdited = useRef(false);
  const form = useForm({
    defaultValues: {
      name: '',
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      onSubmit({ ...value, username: normalizeUsername(value.username) });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <form.Field
        name="name"
        children={(field) => {
          const isInvalid =
            field.state.meta.isTouched && !field.state.meta.isValid;
          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor={field.name}>Name</FieldLabel>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => {
                  field.handleChange(e.target.value);
                  if (!usernameEdited.current) {
                    form.setFieldValue(
                      'username',
                      e.target.value.trim()
                        ? suggestUsername(e.target.value)
                        : ''
                    );
                  }
                }}
                aria-invalid={isInvalid}
                placeholder="John Doe"
                autoComplete="name"
              />
              {isInvalid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          );
        }}
      />
      <form.Field
        name="username"
        children={(field) => {
          const isInvalid =
            field.state.meta.isTouched && !field.state.meta.isValid;
          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor={field.name}>Username</FieldLabel>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => {
                  usernameEdited.current = true;
                  field.handleChange(e.target.value);
                }}
                aria-invalid={isInvalid}
                aria-describedby="username-hint"
                placeholder="john_doe"
                autoComplete="username"
              />
              <p id="username-hint" className="text-xs text-muted-foreground">
                Shown instead of your name on public pages, such as published
                wikis.
              </p>
              {isInvalid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          );
        }}
      />
      <form.Field
        name="email"
        children={(field) => {
          const isInvalid =
            field.state.meta.isTouched && !field.state.meta.isValid;
          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor={field.name}>Email</FieldLabel>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={isInvalid}
                placeholder="hi@example.com"
                autoComplete="email"
              />
              {isInvalid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          );
        }}
      />
      <form.Field
        name="password"
        children={(field) => {
          const isInvalid =
            field.state.meta.isTouched && !field.state.meta.isValid;
          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor={field.name}>Password</FieldLabel>
              <Input
                id={field.name}
                name={field.name}
                type="password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={isInvalid}
                autoComplete="new-password"
                placeholder="********"
              />
              {isInvalid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          );
        }}
      />
      <form.Field
        name="confirmPassword"
        children={(field) => {
          const isInvalid =
            field.state.meta.isTouched && !field.state.meta.isValid;
          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor={field.name}>Confirm Password</FieldLabel>
              <Input
                id={field.name}
                name={field.name}
                type="password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={isInvalid}
                autoComplete="new-password"
                placeholder="********"
              />
              {isInvalid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          );
        }}
      />
      <Button
        type="submit"
        variant="outline"
        className="w-full"
        disabled={isPending}
      >
        {isPending ? (
          <Spinner className="mr-1 size-4" />
        ) : (
          <Mail className="mr-1 size-4" />
        )}
        Register
      </Button>
    </form>
  );
};
