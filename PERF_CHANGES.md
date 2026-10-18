# Performance + schema changes

## A. Performance fixes
- vite.config.ts: removed vite-plugin-singlefile (it defeated the lazy() route splitting); added manualChunks (react, radix, redux, charts). Plugin and unused `date-fns` removed from package.json. `dist` added to .gitignore (commit no build output).
- Modals / overlays: removed backdrop-blur from Dialog overlays, global search, mobile nav, toasts and the sticky header (solid tint instead). LoaderOverlay is unmounted while idle. 32 x `transition-all` replaced by targeted transition properties.
- hooks/useForm.ts: schema / values / labels are read through refs, so inline schema objects no longer rebuild every callback; registerRef returns a cached callback per field (no ref + blur-listener churn per keystroke); setErrors moved out of the setValues updater; numeric handler no longer validates a stale value.
- hooks/index.ts `useTable`: filter/sort memo keyed on the filter *values*; search uses useDeferredValue.
- store: Redux DevTools only in dev. index.html: fonts trimmed to used weights, loaded non-blocking.

## B. Validation schemas split out of the pages
Each feature now owns a `*.schema.ts` next to its service; shared rules live in `src/schemas/rules.ts`.

| File | Exports |
|---|---|
| schemas/rules.ts | Schema type, requiredMin, requiredEmail, requiredPhone, patterns |
| patients/patient.schema.ts | buildPatientSchema, PATIENT_LABELS, validators, parseDobInput, localISO, digits |
| appointments/appointment.schema.ts | appointmentSchema |
| doctors/doctor.schema.ts | doctorSchema |
| users/user.schema.ts | newUserSchema, NEW_USER_LABELS, buildUserSchema(isEdit) |
| admin/role.schema.ts, admin/facility.schema.ts | buildRoleSchema(mode), facilitySchema |
| auth/auth.schema.ts | loginSchema, forgotPasswordSchema, buildForcePasswordSchema, buildResetPasswordSchema |
| billing/payment.schema.ts | buildPaymentSchema(dueAmount) |
| consultations/consultation.schema.ts | consultationSchema |
| Departments/department.schema.ts, Specializations/specialization.schema.ts | departmentSchema, specializationSchema |
| ipd/ipd.schema.ts | admissionSchema, dischargeSchema (+ labels) |
| masterConfiguration/ward.schema.ts | roomType, room, bed, bulkBeds, amenity schemas (+ labels) |

Static schemas are module constants; schemas that depend on runtime values are `build*` functions, memoised in the component.
Rules and messages were moved unchanged.

## Verification done
- Old inline schemas vs new schema files compared by running every rule over sample inputs: 21 schemas/labels (3,643 comparisons) and the patient schema (2,232 comparisons, create + edit) -> 0 differences.
- TypeScript compared against a baseline of the same project: no new errors, no unused imports.
- NOT done: `npm run build` and a browser run (no node_modules / network in the review sandbox).

## Not applied
- Server-side pagination/search and a dashboard summary endpoint.
- React Hook Form + Zod migration (the schema files are now the natural starting point).
- Check VITE_API_BASE_URL in production (Render cold starts).
- Login / permission-bootstrap screens still use a small backdrop-blur on static backgrounds.

Smoke-test before deploying: patient register + edit, appointment, user add/edit, role, billing payment, IPD admission/discharge, ward setup dialogs, login/forgot/reset password.
