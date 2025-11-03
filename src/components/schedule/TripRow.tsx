import React, { memo } from 'react';
import {
  TableRow,
  TableCell,
  Box,
  Typography,
  Chip,
  Tooltip,
  ButtonBase,
  TextField
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Trip, TimePoint } from '../../types/schedule';
import { calculateTripTime } from '../../utils/dateHelpers';

export type EditingRecoveryState = {
  tripNumber: number;
  timePointId: string;
} | null;

type ServiceBand =
  | 'Fastest Service'
  | 'Fast Service'
  | 'Standard Service'
  | 'Slow Service'
  | 'Slowest Service';

export interface TripRowProps {
  trip: Trip;
  idx: number;
  timePoints: TimePoint[];
  originalTravelTimes: Record<string, number>;
  editingRecovery: EditingRecoveryState;
  tempRecoveryValue: string;
  onTimePointToggle: (
    tripNumber: number,
    timePointId: string,
    timePointIndex: number,
    isInactive: boolean,
    event: React.SyntheticEvent
  ) => void;
  onServiceBandClick: (tripNumber: number, band: ServiceBand) => void;
  onRecoveryClick: (tripId: string, timePointId: string, value: number) => void;
  onRecoveryChange: (value: string) => void;
  onRecoverySubmit: (tripNumber: number, timePointId: string, newValue: number) => void;
  onRecoveryCancel: () => void;
  onRecoveryKeyDown: (event: React.KeyboardEvent) => void;
}

const getServiceBandColor = (serviceBand: ServiceBand): string => {
  switch (serviceBand) {
    case 'Fastest Service':
      return '#2e7d32';
    case 'Fast Service':
      return '#388e3c';
    case 'Standard Service':
      return '#f9a825';
    case 'Slow Service':
      return '#f57c00';
    case 'Slowest Service':
      return '#d32f2f';
    default:
      return '#9b9b9b';
  }
};

const TripRow: React.FC<TripRowProps> = memo(({
  trip,
  idx,
  timePoints,
  originalTravelTimes,
  editingRecovery,
  tempRecoveryValue,
  onTimePointToggle,
  onServiceBandClick,
  onRecoveryClick,
  onRecoveryChange,
  onRecoverySubmit,
  onRecoveryCancel,
  onRecoveryKeyDown
}) => {
  const theme = useTheme();
  const serviceBandColor = getServiceBandColor(trip.serviceBand as ServiceBand);

  const firstTimepointId = timePoints[0]?.id;
  const lastActiveIndex = trip.tripEndIndex ?? timePoints.length - 1;
  const lastActiveTimepointId = timePoints[lastActiveIndex]?.id;
  const firstDepartureTime = firstTimepointId
    ? trip.departureTimes[firstTimepointId] || trip.arrivalTimes[firstTimepointId]
    : '';
  const lastDepartureTime = lastActiveTimepointId
    ? trip.departureTimes[lastActiveTimepointId] || trip.arrivalTimes[lastActiveTimepointId]
    : '';
  const tripTime = calculateTripTime(firstDepartureTime || '', lastDepartureTime || '');

  const isEditingRecovery = (timePointId: string) =>
    editingRecovery?.tripNumber === trip.tripNumber && editingRecovery.timePointId === timePointId;

  const renderRecoveryControl = (timePointId: string, value: number | undefined) => {
    if (!isEditingRecovery(timePointId)) {
      return (
        <ButtonBase
          component="span"
          onClick={(event) => {
            event.stopPropagation();
            onRecoveryClick(trip.tripNumber.toString(), timePointId, value || 0);
          }}
          sx={{
            px: 1,
            py: 0.25,
            borderRadius: '6px',
            fontSize: '0.7rem',
            fontWeight: 700,
            color: '#0ea5e9',
            border: '1px solid #7dd3fc',
            backgroundColor: '#f0f9ff',
            transition: 'all 0.2s ease-in-out',
            '&:hover, &:focus-visible': {
              backgroundColor: '#dbeafe',
              borderColor: '#0ea5e9'
            }
          }}
          aria-label={`Edit recovery time for ${timePointId}`}
        >
          {`R: ${value ?? 0}min`}
        </ButtonBase>
      );
    }

    return (
      <TextField
        size="small"
        value={tempRecoveryValue}
        autoFocus
        inputProps={{
          'data-recovery-edit': 'true',
          inputMode: 'numeric',
          pattern: '[0-9]*',
          'aria-label': `Recovery minutes for ${timePointId}`
        }}
        onChange={(event) => onRecoveryChange(event.target.value)}
        onKeyDown={onRecoveryKeyDown}
        sx={{ width: 80 }}
      />
    );
  };

  const totalRecoveryMinutes = trip.recoveryTimes
    ? Object.values(trip.recoveryTimes).reduce((sum, time) => sum + (time || 0), 0)
    : 0;

  const travelMinutes = (() => {
    const stored = originalTravelTimes[trip.tripNumber.toString()] || 0;
    if (stored > 0) return stored;
    const bandMinutes = trip.serviceBandInfo?.totalMinutes || 0;
    return Math.round(bandMinutes);
  })();

  const recoveryPercentage = (() => {
    if (travelMinutes === 0) {
      return { value: 0, color: '#dc2626', backgroundColor: '#fef2f2', tooltip: 'Not enough recovery time' };
    }

    const percentage = Math.round((totalRecoveryMinutes / travelMinutes) * 100);
    if (percentage < 10) {
      return { value: percentage, color: '#dc2626', backgroundColor: '#fef2f2', tooltip: 'Not enough recovery time' };
    }
    if (percentage < 15) {
      return { value: percentage, color: '#ca8a04', backgroundColor: '#fefce8', tooltip: 'Okay recovery time' };
    }
    if (percentage <= 18) {
      return { value: percentage, color: '#059669', backgroundColor: '#ecfdf5', tooltip: 'Good recovery time' };
    }
    return { value: percentage, color: '#dc2626', backgroundColor: '#fef2f2', tooltip: 'Too much recovery time' };
  })();

  return (
    <TableRow
      sx={{
        height: '48px',
        backgroundColor: idx % 2 === 0 ? '#fafbfc' : '#ffffff',
        '&:hover': {
          backgroundColor: '#e3f2fd',
          '& .MuiTableCell-root': {
            fontWeight: 500
          }
        }
      }}
    >
      <TableCell sx={{
        p: '12px',
        fontSize: '14px',
        textAlign: 'center',
        fontWeight: 600,
        color: '#475569',
        borderRight: '1px solid #e2e8f0',
        minWidth: '80px'
      }}>
        {trip.blockNumber}
      </TableCell>

      <TableCell sx={{
        p: '12px',
        fontSize: '16px',
        textAlign: 'center',
        fontWeight: 'bold',
        color: theme.palette.primary.dark,
        borderRight: '1px solid #e2e8f0',
        minWidth: '80px'
      }}>
        {trip.tripNumber}
      </TableCell>

      <TableCell sx={{
        p: '8px',
        textAlign: 'center',
        borderRight: '1px solid #e2e8f0',
        minWidth: '140px'
      }}>
        <Chip
          component="button"
          label={trip.serviceBand}
          size="small"
          onClick={() => onServiceBandClick(trip.tripNumber, trip.serviceBand as ServiceBand)}
          sx={{
            backgroundColor: `${serviceBandColor}20`,
            color: serviceBandColor,
            border: `1px solid ${serviceBandColor}40`,
            fontWeight: 600,
            fontSize: '0.75rem'
          }}
        />
      </TableCell>

      {timePoints.map((tp, tpIndex) => {
        const isActive = trip.tripEndIndex === undefined || tpIndex <= trip.tripEndIndex;
        const isInactive = !isActive;
        const isClickable = (tpIndex > 0 && isActive) || isInactive;
        const displayLabel = tpIndex === 0 ? 'dep' : 'arr';
        const primaryTime = tpIndex === 0
          ? trip.departureTimes[tp.id] || trip.arrivalTimes[tp.id] || '-'
          : trip.arrivalTimes[tp.id] || '-';

        const ariaLabel = isInactive
          ? `Restore trip ${trip.tripNumber} at ${tp.name}`
          : tpIndex === 0
            ? `${tp.name} departure`
            : `End trip ${trip.tripNumber} at ${tp.name}`;

        return (
          <TableCell
            key={tp.id}
            sx={{
              p: '12px',
              borderRight: '1px solid #f1f5f9',
              minWidth: '80px',
              color: isActive ? '#334155' : '#9ca3af',
              backgroundColor: isActive ? 'transparent' : '#1f2937'
            }}
          >
            <ButtonBase
              onClick={(event) => onTimePointToggle(trip.tripNumber, tp.id, tpIndex, isInactive, event)}
              disabled={!isClickable}
              sx={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                color: 'inherit',
                borderRadius: '4px',
                p: 0.5,
                '&:hover, &:focus-visible': {
                  backgroundColor: isActive ? '#fef3c7' : '#374151'
                }
              }}
              aria-label={ariaLabel}
            >
              <Typography component="span" sx={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                {displayLabel}:
              </Typography>
              <Typography
                component="span"
                sx={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: tpIndex === 0 ? '#3b82f6' : 'inherit'
                }}
              >
                {primaryTime}
              </Typography>
              {isInactive && (
                <Typography component="span" sx={{ fontSize: '0.7rem', color: '#e2e8f0' }}>
                  ---
                </Typography>
              )}
            </ButtonBase>

            {(isActive && trip.recoveryTimes && trip.recoveryTimes[tp.id] !== undefined) && (
              <Box sx={{ mt: '4px', textAlign: 'center' }}>
                {renderRecoveryControl(tp.id, trip.recoveryTimes[tp.id])}
              </Box>
            )}
            {isInactive && trip.originalRecoveryTimes?.[tp.id] !== undefined && (
              <Box sx={{ mt: '4px', textAlign: 'center' }}>
                {renderRecoveryControl(tp.id, trip.originalRecoveryTimes[tp.id])}
              </Box>
            )}
          </TableCell>
        );
      })}

      <TableCell sx={{
        p: '12px',
        fontSize: '13px',
        textAlign: 'center',
        fontFamily: 'monospace',
        fontWeight: 600,
        color: '#1976d2',
        backgroundColor: '#f3f7ff',
        minWidth: '80px'
      }}>
        {tripTime}
      </TableCell>

      <TableCell sx={{
        p: '12px',
        fontSize: '13px',
        textAlign: 'center',
        fontFamily: 'monospace',
        fontWeight: 600,
        color: '#0d9488',
        backgroundColor: '#f0f9ff',
        minWidth: '80px'
      }}>
        {totalRecoveryMinutes > 0 ? `${totalRecoveryMinutes}min` : '0min'}
      </TableCell>

      <TableCell sx={{
        p: '12px',
        fontSize: '13px',
        textAlign: 'center',
        fontFamily: 'monospace',
        fontWeight: 600,
        color: '#059669',
        backgroundColor: '#ecfdf5',
        minWidth: '80px'
      }}>
        {`${travelMinutes}min`}
      </TableCell>

      <TableCell sx={{
        p: '12px',
        fontSize: '13px',
        textAlign: 'center',
        fontFamily: 'monospace',
        fontWeight: 600,
        minWidth: '100px'
      }}>
        <Tooltip title={recoveryPercentage.tooltip} arrow>
          <Box
            component="span"
            sx={{
              color: recoveryPercentage.color,
              backgroundColor: recoveryPercentage.backgroundColor,
              borderRadius: '4px',
              py: '2px',
              px: '6px',
              display: 'inline-block'
            }}
          >
            {`${recoveryPercentage.value}%`}
          </Box>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
});

TripRow.displayName = 'TripRow';

export default TripRow;
