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

// Helper to wrap stacks in DashboardLayout (similar to web <DashboardLayout>)
const withLayout = (StackComponent) => {
    return function LayoutWrapper(props) {
        return (
            <DashboardLayout>
                <StackComponent {...props} />
            </DashboardLayout>
        );
    }
};

const CentralAdminStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="CentralAdminDashboard" component={CentralAdminDashboard} />
        <Stack.Screen name="SystemRevenueDashboard" component={SystemRevenueDashboard} />
        <Stack.Screen name="AdminQuestionLibrary" component={AdminQuestionLibrary} />
        <Stack.Screen name="ConsentManagement" component={ConsentManagement} />
        <Stack.Screen name="AdminRoles" component={AdminRoles} />
        <Stack.Screen name="Admin" component={Admin} />
    </Stack.Navigator>
);

const HospitalAdminStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="HospitalAdminDashboard" component={HospitalAdminDashboard} />
        <Stack.Screen name="ClinicDashboard" component={ClinicDashboard} />
        <Stack.Screen name="HospitalAdminQuestionLibrary" component={HospitalAdminQuestionLibrary} />
        <Stack.Screen name="BedManagement" component={BedManagement} />
    </Stack.Navigator>
);

const DoctorStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="DoctorDashboard" component={Patient} />
        <Stack.Screen name="DoctorPatients" component={Patient} />
        <Stack.Screen name="DoctorPatientDetails" component={DoctorPatientDetails} />
        <Stack.Screen name="AIAssistant" component={AIAssistant} />
    </Stack.Navigator>
);

const OTStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="OTDashboard" component={OTDashboard} />
        <Stack.Screen name="OTPlannedSurgeries" component={OTPlannedSurgeries} />
        <Stack.Screen name="OTSchedulePage" component={OTSchedulePage} />
        <Stack.Screen name="OTRoomsPage" component={OTRoomsPage} />
        <Stack.Screen name="OTPreOpPage" component={OTPreOpPage} />
        <Stack.Screen name="OTInProgressPage" component={OTInProgressPage} />
        <Stack.Screen name="OTPostOpPage" component={OTPostOpPage} />
        <Stack.Screen name="OTCompletedPage" component={OTCompletedPage} />
        <Stack.Screen name="OTSurgeonsPage" component={OTSurgeonsPage} />
        <Stack.Screen name="OTReportsPage" component={OTReportsPage} />
    </Stack.Navigator>
);

const LabStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="LabDashboard" component={LabDashboard} />
        <Stack.Screen name="AssignedTests" component={AssignedTests} />
        <Stack.Screen name="CompletedReports" component={CompletedReports} />
    </Stack.Navigator>
);

const PharmacyStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="PharmacyInventory" component={PharmacyInventory} />
        <Stack.Screen name="PharmacyOrders" component={PharmacyOrders} />
        <Stack.Screen name="PurchaseInvoiceHistory" component={PurchaseInvoiceHistory} />
        <Stack.Screen name="PharmacyReturns" component={PharmacyReturns} />
        <Stack.Screen name="VendorReturns" component={VendorReturns} />
        <Stack.Screen name="PharmacyCollections" component={PharmacyCollections} />
        <Stack.Screen name="PharmacyDepartments" component={PharmacyDepartments} />
    </Stack.Navigator>
);

const ReceptionStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="ReceptionDashboard" component={ReceptionDashboard} />
        <Stack.Screen name="ReceptionPatients" component={ReceptionPatients} />
        <Stack.Screen name="PatientBillingProfile" component={PatientBillingProfile} />
    </Stack.Navigator>
);

const CashierStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="CashierDashboard" component={CashierDashboard} />
        <Stack.Screen name="PatientBillingProfile" component={PatientBillingProfile} />
    </Stack.Navigator>
);

const PatientStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="PatientDashboard" component={PatientDashboard} />
        <Stack.Screen name="UnifiedPatientProfile" component={UnifiedPatientProfile} />
    </Stack.Navigator>
);

// We export wrapped versions so the DashboardLayout renders correctly
export const CentralAdminApp = withLayout(CentralAdminStack);
export const HospitalAdminApp = withLayout(HospitalAdminStack);
export const DoctorApp = withLayout(DoctorStack);
export const OTApp = withLayout(OTStack);
export const LabApp = withLayout(LabStack);
export const PharmacyApp = withLayout(PharmacyStack);
export const ReceptionApp = withLayout(ReceptionStack);
export const CashierApp = withLayout(CashierStack);
export const PatientApp = PatientStack; // Usually patients don't get the staff dashboard layout
