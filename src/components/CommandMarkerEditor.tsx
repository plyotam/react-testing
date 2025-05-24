import React, { useState, useEffect, useCallback } from 'react';
import { CommandMarker, OptimizedPathPoint } from '../types';
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes } from 'react-icons/fa';

interface CommandMarkerEditorProps {
  commandMarkers: CommandMarker[];
  optimizedPath: OptimizedPathPoint[];
  onAddCommandMarker: (markerData: Omit<CommandMarker, 'id'>) => void;
  onUpdateCommandMarker: (marker: CommandMarker) => void;
  onDeleteCommandMarker: (markerId: string) => void;
  pendingCommandMarkerCreation: { s: number, time: number, x: number, y: number } | null;
  clearPendingCommandMarkerCreation: () => void;
}

// Define a type for the form data to ensure commandParams is always at least {}
type CommandMarkerFormData = Omit<CommandMarker, 'id' | 'commandParams'> & {
  commandParams: any; // Make it non-optional for the form state
};

// If editing, it will be a full CommandMarker which has an id
type FormState = CommandMarkerFormData | (CommandMarker & { commandParams: any });

// Define initialFormState outside the component to ensure it's stable
const initialFormState: CommandMarkerFormData = {
  s: 0,
  time: 0,
  commandName: '',
  commandParams: {},
};

const CommandMarkerEditor: React.FC<CommandMarkerEditorProps> = ({
  commandMarkers,
  optimizedPath,
  onAddCommandMarker,
  onUpdateCommandMarker,
  onDeleteCommandMarker,
  pendingCommandMarkerCreation,
  clearPendingCommandMarkerCreation,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [newMarkerData, setNewMarkerData] = useState<FormState>(initialFormState);

  const handleStartCreate = useCallback(() => {
    setIsCreating(true);
    setEditingMarkerId(null);
    setNewMarkerData(initialFormState);
  }, []);

  useEffect(() => {
    if (pendingCommandMarkerCreation && optimizedPath.length > 0) {
      handleStartCreate(); 
      setNewMarkerData(prev => ({
        ...initialFormState, 
        s: pendingCommandMarkerCreation.s,
        time: pendingCommandMarkerCreation.time,
        commandName: 'New Path Command', 
      }));
      clearPendingCommandMarkerCreation(); 
    }
  }, [pendingCommandMarkerCreation, clearPendingCommandMarkerCreation, optimizedPath.length, handleStartCreate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 's' || name === 'time') {
      const numericValue = parseFloat(value);
      const finalValue = isNaN(numericValue) ? 0 : numericValue;

      setNewMarkerData(prev => {
        const updatedState = { ...prev, [name]: finalValue };
        if (optimizedPath.length > 0) {
          if (name === 's') {
            let closestTime = 0;
            let minDiff = Infinity;
            optimizedPath.forEach(p => {
              const diff = Math.abs(p.s - finalValue);
              if (diff < minDiff) {
                minDiff = diff;
                closestTime = p.time;
              }
            });
            updatedState.time = parseFloat(closestTime.toFixed(3));
          } else if (name === 'time') {
            let closestS = 0;
            let minDiff = Infinity;
            optimizedPath.forEach(p => {
              const diff = Math.abs(p.time - finalValue);
              if (diff < minDiff) {
                minDiff = diff;
                closestS = p.s;
              }
            });
            updatedState.s = parseFloat(closestS.toFixed(3));
          }
        }
        return updatedState;
      });
    } else if (name === 'commandParams') {
      try {
        const parsedParams = JSON.parse(value);
        setNewMarkerData(prev => ({ ...prev, commandParams: parsedParams }));
      } catch (err) {
        // Store as string if invalid JSON, allowing user to correct it.
        // The type 'any' for commandParams in FormState allows this.
        setNewMarkerData(prev => ({ ...prev, commandParams: value })); 
        console.warn("Invalid JSON for commandParams, storing as string.");
      }
    } else {
      setNewMarkerData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleSave = () => {
    if (!newMarkerData.commandName) {
      alert('Command Name is required.');
      return;
    }

    // Ensure commandParams is an object if it was stored as a string due to parsing error
    let finalCommandParams = newMarkerData.commandParams;
    if (typeof finalCommandParams === 'string') {
        try {
            finalCommandParams = JSON.parse(finalCommandParams);
        } catch (e) {
            alert("Command Parameters contains invalid JSON. Please correct it or ensure it's a valid JSON object string.");
            return;
        }
    }


    if (editingMarkerId && 'id' in newMarkerData) { // Editing existing marker
        const markerToUpdate: CommandMarker = {
            ...(newMarkerData as CommandMarker), // It has an id, so it's a CommandMarker
            commandParams: finalCommandParams,
        };
        onUpdateCommandMarker(markerToUpdate);
    } else { // Adding new marker
        const markerToAdd: Omit<CommandMarker, 'id'> = {
            s: newMarkerData.s,
            time: newMarkerData.time,
            commandName: newMarkerData.commandName,
            commandParams: finalCommandParams,
        };
        onAddCommandMarker(markerToAdd);
    }
    setIsCreating(false);
    setEditingMarkerId(null);
    setNewMarkerData(initialFormState);
  };

  const handleEdit = (marker: CommandMarker) => {
    setIsCreating(false);
    setEditingMarkerId(marker.id);
    // Ensure commandParams is an object for the form state, even if undefined on original marker
    setNewMarkerData({ ...marker, commandParams: marker.commandParams || {} }); 
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingMarkerId(null);
    setNewMarkerData(initialFormState);
  };

  const isDisabled = optimizedPath.length === 0;

  // Determine if current commandParams is a string (likely due to parse error)
  const commandParamsIsString = typeof newMarkerData.commandParams === 'string';

  return (
    <div className={`p-3 bg-background-secondary shadow-lg rounded-lg text-text-primary transition-all duration-300 ease-in-out ${isDisabled ? 'opacity-70 pointer-events-none' : ''}`}>
      <h3 className="text-lg font-semibold mb-2 border-b border-border-color-primary pb-1">Path Command Markers</h3>
      {isDisabled && <p className="text-sm text-text-secondary mb-2">Create an optimized path first to add command markers.</p>}
      
      {(!isCreating && !editingMarkerId) && (
        <button
          onClick={handleStartCreate}
          disabled={isDisabled}
          className="w-full flex items-center justify-center bg-accent-success text-white py-2 px-4 rounded-md hover:bg-opacity-80 transition-colors duration-150 ease-in-out mb-3 shadow disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FaPlus className="mr-2" /> Add New Marker
        </button>
      )}

      {(isCreating || editingMarkerId) && (
        <div className="mb-4 p-3 bg-background-tertiary rounded-md shadow">
          <h4 className="text-md font-semibold mb-2 text-text-primary">{editingMarkerId ? 'Edit' : 'New'} Marker</h4>
          <div className="space-y-2 text-sm">
            <div>
              <label htmlFor="s" className="block text-xs font-medium text-text-secondary">Distance (s, meters)</label>
              <input
                type="number"
                name="s"
                id="s"
                step="0.01"
                value={newMarkerData.s}
                onChange={handleInputChange}
                className="mt-1 block w-full px-2 py-1.5 border border-border-color-secondary rounded-md shadow-sm focus:ring-accent-info focus:border-accent-info sm:text-sm bg-input-background text-text-primary placeholder-text-tertiary"
                placeholder="Distance along path"
              />
            </div>
            <div>
              <label htmlFor="time" className="block text-xs font-medium text-text-secondary">Time (seconds)</label>
              <input
                type="number"
                name="time"
                id="time"
                step="0.01"
                value={newMarkerData.time}
                onChange={handleInputChange}
                className="mt-1 block w-full px-2 py-1.5 border border-border-color-secondary rounded-md shadow-sm focus:ring-accent-info focus:border-accent-info sm:text-sm bg-input-background text-text-primary placeholder-text-tertiary"
                placeholder="Time into path"
              />
            </div>
            <div>
              <label htmlFor="commandName" className="block text-xs font-medium text-text-secondary">Command Name</label>
              <input
                type="text"
                name="commandName"
                id="commandName"
                value={newMarkerData.commandName}
                onChange={handleInputChange}
                className="mt-1 block w-full px-2 py-1.5 border border-border-color-secondary rounded-md shadow-sm focus:ring-accent-info focus:border-accent-info sm:text-sm bg-input-background text-text-primary placeholder-text-tertiary"
                placeholder="e.g., IntakeOn"
              />
            </div>
            <div>
              <label htmlFor="commandParams" className="block text-xs font-medium text-text-secondary">Command Parameters (JSON {commandParamsIsString && <span className="text-warning-color text-xs">(currently invalid string)</span>})</label>
              <textarea
                name="commandParams"
                id="commandParams"
                rows={2}
                value={commandParamsIsString ? newMarkerData.commandParams : JSON.stringify(newMarkerData.commandParams, null, 2)}
                onChange={handleInputChange}
                className={`mt-1 block w-full px-2 py-1.5 border rounded-md shadow-sm focus:ring-accent-info focus:border-accent-info sm:text-sm bg-input-background text-text-primary placeholder-text-tertiary font-mono text-xs ${commandParamsIsString ? 'border-warning-color' : 'border-border-color-secondary'}`}
                placeholder='{\"power\": 0.5}'
              />
              {commandParamsIsString && (
                <p className="mt-1 text-xs text-warning-color">
                  The entered parameters are not valid JSON. Please correct it.
                </p>
              )}
            </div>
          </div>
          <div className="mt-3 flex justify-end space-x-2">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm rounded-md bg-background-hover-muted text-text-secondary hover:bg-opacity-80 transition-colors"
            >
              <FaTimes className="inline mr-1"/> Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-sm rounded-md bg-accent-confirm text-white hover:bg-opacity-80 transition-colors shadow"
            >
             <FaSave className="inline mr-1"/> {editingMarkerId ? 'Save Changes' : 'Add Marker'}
            </button>
          </div>
        </div>
      )}

      {commandMarkers.length > 0 && (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {commandMarkers.map((marker) => (
            <div key={marker.id} className="p-2.5 bg-background-tertiary rounded-md shadow-sm hover:shadow-md transition-shadow duration-150 ease-in-out">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-text-primary text-sm">{marker.commandName}</p>
                  <p className="text-xs text-text-secondary">
                    s: {marker.s.toFixed(2)}m, t: {marker.time.toFixed(2)}s
                  </p>
                </div>
                <div className="flex space-x-1.5">
                  <button
                    onClick={() => handleEdit(marker)}
                    disabled={isDisabled}
                    className="p-1.5 text-text-secondary hover:text-accent-info rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Edit Marker"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => onDeleteCommandMarker(marker.id)}
                    disabled={isDisabled}
                    className="p-1.5 text-text-secondary hover:text-accent-danger rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Delete Marker"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
              {marker.commandParams && Object.keys(marker.commandParams).length > 0 && (
                <pre className="mt-1.5 text-xs bg-background-primary p-1.5 rounded text-text-tertiary overflow-x-auto">
                  {JSON.stringify(marker.commandParams, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
       {commandMarkers.length === 0 && !isDisabled && !isCreating && !editingMarkerId && (
         <p className="text-sm text-text-secondary italic text-center py-2">No command markers added yet.</p>
       )}
    </div>
  );
};

export default CommandMarkerEditor; 