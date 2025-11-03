import React, { useRef, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Paper,
  Stack,
  Divider
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store/store';
import { processTodShiftImports } from './store/shiftManagementSlice';

interface MasterScheduleImportProps {
  onSuccess?: (details: { cityFileName: string; contractorFileName: string }) => void;
}

const MasterScheduleImport: React.FC<MasterScheduleImportProps> = ({ onSuccess }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error, importMetadata } = useSelector((state: RootState) => ({
    loading: state.shiftManagement.loading.imports,
    error: state.shiftManagement.error.imports,
    importMetadata: state.shiftManagement.importMetadata
  }));

  const cityInputRef = useRef<HTMLInputElement | null>(null);
  const contractorInputRef = useRef<HTMLInputElement | null>(null);

  const [cityFile, setCityFile] = useState<File | null>(null);
  const [contractorFile, setContractorFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);

  const resetInputs = () => {
    setCityFile(null);
    setContractorFile(null);
    if (cityInputRef.current) {
      cityInputRef.current.value = '';
    }
    if (contractorInputRef.current) {
      contractorInputRef.current.value = '';
    }
  };

  const handleProcessImports = async () => {
    if (!cityFile || !contractorFile) {
      setLocalError('Both CSV files are required before processing.');
      return;
    }

    setLocalError(null);
    setLocalSuccess(null);

    try {
      await dispatch(processTodShiftImports({ cityFile, contractorFile })).unwrap();
      setLocalSuccess(`Import completed (${cityFile.name} / ${contractorFile.name}).`);
      onSuccess?.({
        cityFileName: cityFile.name,
        contractorFileName: contractorFile.name
      });
      resetInputs();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process imports.';
      setLocalError(message);
    }
  };

  const cityFileLabel = cityFile?.name ?? 'Import Master Schedule';
  const contractorFileLabel = contractorFile?.name ?? 'Insert MVT TOD shifts';

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Import TOD Shift Data
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Load the City of Barrie master requirements and contractor shift rosters. Files are aligned to 15-minute
        intervals (04:00 – 01:00) and persisted to Firebase for re-runs.
      </Typography>

      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle2">Import Master Schedule</Typography>
          <Button
            variant="outlined"
            component="label"
            sx={{ mt: 1 }}
            disabled={loading}
          >
            {cityFileLabel}
            <input
              type="file"
              accept=".csv"
              hidden
              ref={cityInputRef}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setCityFile(file);
              }}
            />
          </Button>
        </Box>

        <Box>
          <Typography variant="subtitle2">Insert MVT TOD shifts</Typography>
          <Button
            variant="outlined"
            component="label"
            sx={{ mt: 1 }}
            disabled={loading}
          >
            {contractorFileLabel}
            <input
              type="file"
              accept=".csv"
              hidden
              ref={contractorInputRef}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setContractorFile(file);
              }}
            />
          </Button>
        </Box>

        <Divider />

        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            variant="contained"
            onClick={handleProcessImports}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Process Imports'}
          </Button>
          {loading && <CircularProgress size={20} />}
        </Stack>

        {(localError || error) && (
          <Alert severity="error">
            {localError || error}
          </Alert>
        )}

        {(localSuccess || importMetadata.importedAt) && !loading && (
          <Alert severity="success">
            {localSuccess ??
              `Last import (${importMetadata.cityFileName} / ${importMetadata.contractorFileName}) at ${importMetadata.importedAt}`} 
          </Alert>
        )}
      </Stack>
    </Paper>
  );
};

export default MasterScheduleImport;
