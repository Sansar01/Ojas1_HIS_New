// import { useRootSelector } from "@/hooks";

// export function useEntitlements() {
//   const modules = useRootSelector((s) => s.entitlements.modules);
//   const loading = useRootSelector((s) => s.entitlements.loading);

//   const hasModule = (code: string) =>
//     modules.some((m: any) => m.code === code && m.isActive);

//   const hasFeature = (moduleCode: string, featureCode: string) => {
//     const module = modules.find((m: any) => m.code === moduleCode);
//     return (
//       module?.features.some((f: any) => f.code === featureCode && f.isActive) ??
//       false
//     );
//   };

//   const canPerformAction = (moduleCode: string, action: string) => {
//     const module = modules.find((m: any) => m.code === moduleCode);
//     return (
//       module?.features.some((f: any) => f.action === action && f.isActive) ??
//       false
//     );
//   };

//   return {
//     modules,
//     loading,
//     hasModule,
//     hasFeature,
//     canPerformAction,
//   };
// }
