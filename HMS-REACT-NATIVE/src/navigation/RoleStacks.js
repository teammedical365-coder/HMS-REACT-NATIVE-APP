import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Dashboard Layout
import DashboardLayout from '../components/layouts/DashboardLayout';

// -- Central Admin Pages --
import CentralAdminDashboard from '../screens/centraladmin/CentralAdminDashboard';
import SystemRevenueDashboard from '../screens/centraladmin/SystemRevenueDashboard';
import AdminQuestionLibrary from '../screens/admin/AdminQuestionLibrary';
import ConsentManagement from '../screens/admin/ConsentManagement';
import AdminRoles from '../screens/admin/AdminRoles';
import Admin from '../screens/admin/Admin';
import AdminDoctors from '../screens/admin/AdminDoctors';
import AdminLabTests from '../screens/admin/AdminLabTests';
import AdminTestPackages from '../screens/admin/AdminTestPackages';
import AdminMedicines from '../screens/admin/AdminMedicines';
import AdminServices from '../screens/admin/AdminServices';

// -- Hospital Admin Pages --
import HospitalAdminDashboard from '../screens/hospitaladmin/HospitalAdminDashboard';
import ClinicDashboard from '../screens/hospitaladmin/ClinicDashboard';
import HospitalAdminQuestionLibrary from '../screens/hospitaladmin/HospitalAdminQuestionLibrary';
import BedManagement from '../screens/hospitaladmin/BedManagement'; // Based on audit

// -- Doctor Pages --
import Patient from '../screens/doctors/Patient';
import DoctorPatientDetails from '../screens/doctors/DoctorPatientDetails';
import AIAssistant from '../screens/doctors/AIAssistant';

// -- OT Pages --
import OTDashboard from '../screens/ot/OTDashboard';
import OTPlannedSurgeries from '../screens/ot/OTPlannedSurgeries';
import OTSchedulePage from '../screens/ot/OTSchedulePage';
import OTRoomsPage from '../screens/ot/OTRoomsPage';
import OTPreOpPage from '../screens/ot/OTPreOpPage';
import OTInProgressPage from '../screens/ot/OTInProgressPage';
import OTPostOpPage from '../screens/ot/OTPostOpPage';
import OTCompletedPage from '../screens/ot/OTCompletedPage';
import OTSurgeonsPage from '../screens/ot/OTSurgeonsPage';
import OTReportsPage from '../screens/ot/OTReportsPage';

// -- Lab Pages --
import LabDashboard from '../screens/lab/LabDashboard';
import AssignedTests from '../screens/lab/AssignedTests';
import CompletedReports from '../screens/lab/CompletedReports';

// -- Pharmacy Pages --
import PharmacyInventory from '../screens/pharmacy/PharmacyInventory';
import PharmacyOrders from '../screens/pharmacy/PharmacyOrders';
import PurchaseInvoiceHistory from '../screens/pharmacy/PurchaseInvoiceHistory';
import PharmacyReturns from '../screens/pharmacy/PharmacyReturns';
import VendorReturns from '../screens/pharmacy/VendorReturns';
import PharmacyCollections from '../screens/pharmacy/PharmacyCollections';
import PharmacyDepartments from '../screens/pharmacy/PharmacyDepartments';

// -- Reception Pages --
import ReceptionDashboard from '../screens/reception/ReceptionDashboard';
import ReceptionPatients from '../screens/reception/ReceptionPatients';

// -- Cashier & Billing Pages --
import CashierDashboard from '../screens/cashier/CashierDashboard';
import PatientBillingProfile from '../screens/billing/PatientBillingProfile';

// -- Patient Pages --
import PatientDashboard from '../screens/patient/PatientDashboard';
import UnifiedPatientProfile from '../screens/patient/UnifiedPatientProfile';

const Stack = createNativeStackNavigator();

// Helper to wrap screens in DashboardLayout (similar to web <DashboardLayout>)
const withLayout = (Component) => {
    return function LayoutWrapper(props) {
        return (
            <DashboardLayout>
                <Component {...props} />
            </DashboardLayout>
        );
    }
};

export const CentralAdminApp = () => (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="CentralAdminDashboard" component={withLayout(CentralAdminDashboard)} />
        <Stack.Screen name="CentralAdminStack" component={withLayout(CentralAdminDashboard)} />
        <Stack.Screen name="SystemRevenueDashboard" component={withLayout(SystemRevenueDashboard)} />
        <Stack.Screen name="AdminQuestionLibrary" component={withLayout(AdminQuestionLibrary)} />
        <Stack.Screen name="ConsentManagement" component={withLayout(ConsentManagement)} />
        <Stack.Screen name="AdminRoles" component={withLayout(AdminRoles)} />
        <Stack.Screen name="AdminLabTests" component={withLayout(AdminLabTests)} />
        <Stack.Screen name="AdminTestPackages" component={withLayout(AdminTestPackages)} />
        <Stack.Screen name="AdminMedicines" component={withLayout(AdminMedicines)} />
        <Stack.Screen name="AdminServices" component={withLayout(AdminServices)} />
        <Stack.Screen name="Admin" component={withLayout(Admin)} />
    </Stack.Navigator>
);

export const HospitalAdminApp = () => (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="HospitalAdminStack" component={withLayout(HospitalAdminDashboard)} />
        <Stack.Screen name="HospitalAdminDashboard" component={withLayout(HospitalAdminDashboard)} />
        <Stack.Screen name="ClinicDashboard" component={withLayout(ClinicDashboard)} />
        <Stack.Screen name="HospitalAdminQuestionLibrary" component={withLayout(HospitalAdminQuestionLibrary)} />
        <Stack.Screen name="BedManagement" component={withLayout(BedManagement)} />
        <Stack.Screen name="OTDashboard" component={withLayout(OTDashboard)} />
        <Stack.Screen name="Admin" component={withLayout(Admin)} />
        <Stack.Screen name="AdminDoctors" component={withLayout(AdminDoctors)} />
        <Stack.Screen name="PharmacyInventory" component={withLayout(PharmacyInventory)} />
    </Stack.Navigator>
);

export const DoctorApp = () => (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="DoctorDashboard" component={withLayout(Patient)} />
        <Stack.Screen name="DoctorPatients" component={withLayout(Patient)} />
        <Stack.Screen name="DoctorPatientDetails" component={withLayout(DoctorPatientDetails)} />
        <Stack.Screen name="AIAssistant" component={withLayout(AIAssistant)} />
    </Stack.Navigator>
);

export const OTApp = () => (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="OTDashboard" component={withLayout(OTDashboard)} />
        <Stack.Screen name="OTPlannedSurgeries" component={withLayout(OTPlannedSurgeries)} />
        <Stack.Screen name="OTSchedulePage" component={withLayout(OTSchedulePage)} />
        <Stack.Screen name="OTRoomsPage" component={withLayout(OTRoomsPage)} />
        <Stack.Screen name="OTPreOpPage" component={withLayout(OTPreOpPage)} />
        <Stack.Screen name="OTInProgressPage" component={withLayout(OTInProgressPage)} />
        <Stack.Screen name="OTPostOpPage" component={withLayout(OTPostOpPage)} />
        <Stack.Screen name="OTCompletedPage" component={withLayout(OTCompletedPage)} />
        <Stack.Screen name="OTSurgeonsPage" component={withLayout(OTSurgeonsPage)} />
        <Stack.Screen name="OTReportsPage" component={withLayout(OTReportsPage)} />
    </Stack.Navigator>
);

export const LabApp = () => (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="LabDashboard" component={withLayout(LabDashboard)} />
        <Stack.Screen name="AssignedTests" component={withLayout(AssignedTests)} />
        <Stack.Screen name="CompletedReports" component={withLayout(CompletedReports)} />
    </Stack.Navigator>
);

export const PharmacyApp = () => (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="PharmacyInventory" component={withLayout(PharmacyInventory)} />
        <Stack.Screen name="PharmacyOrders" component={withLayout(PharmacyOrders)} />
        <Stack.Screen name="PurchaseInvoiceHistory" component={withLayout(PurchaseInvoiceHistory)} />
        <Stack.Screen name="PharmacyReturns" component={withLayout(PharmacyReturns)} />
        <Stack.Screen name="VendorReturns" component={withLayout(VendorReturns)} />
        <Stack.Screen name="PharmacyCollections" component={withLayout(PharmacyCollections)} />
        <Stack.Screen name="PharmacyDepartments" component={withLayout(PharmacyDepartments)} />
    </Stack.Navigator>
);

export const ReceptionApp = () => (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="ReceptionDashboard" component={withLayout(ReceptionDashboard)} />
        <Stack.Screen name="ReceptionPatients" component={withLayout(ReceptionPatients)} />
        <Stack.Screen name="PatientBillingProfile" component={withLayout(PatientBillingProfile)} />
    </Stack.Navigator>
);

export const CashierApp = () => (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="CashierDashboard" component={withLayout(CashierDashboard)} />
        <Stack.Screen name="PatientBillingProfile" component={withLayout(PatientBillingProfile)} />
    </Stack.Navigator>
);

export const PatientApp = () => (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="PatientDashboard" component={PatientDashboard} />
        <Stack.Screen name="UnifiedPatientProfile" component={UnifiedPatientProfile} />
    </Stack.Navigator>
);
