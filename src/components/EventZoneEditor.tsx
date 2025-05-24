import React, { useState, useEffect, useCallback } from 'react';
import { EventZone } from '../types';
import { PlusCircle, Edit3, Trash2, Save, XCircle } from 'lucide-react';

interface EventZoneEditorProps {
  eventZones: EventZone[];
  onAddEventZone: (zoneData: Omit<EventZone, 'id'>) => void;
  onUpdateEventZone: (zone: EventZone) => void;
  onDeleteEventZone: (zoneId: string) => void;
  pendingEventZoneCreation: { x: number, y: number } | null;
  clearPendingEventZoneCreation: () => void;
  selectedZoneId: string | null;
  setSelectedZoneId: (zoneId: string | null) => void; // To select zone on edit
}

// Define initialZoneData outside the component
const initialZoneData: Omit<EventZone, 'id'> = {
  x: 0,
  y: 0,
  radius: 1,
  commandName: 'NewCommand',
  triggerType: 'onEnter',
  onExitCommandName: '',
  color: '#FFA500',
};

const EventZoneEditor: React.FC<EventZoneEditorProps> = ({
  eventZones,
  onAddEventZone,
  onUpdateEventZone,
  onDeleteEventZone,
  pendingEventZoneCreation,
  clearPendingEventZoneCreation,
  selectedZoneId,
  setSelectedZoneId,
}) => {
  const [editingZone, setEditingZone] = useState<EventZone | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newZoneData, setNewZoneData] = useState<Omit<EventZone, 'id'> | EventZone>(initialZoneData);

  const handleStartCreate = useCallback(() => {
    setIsCreatingNew(true);
    setEditingZone(null);
    setNewZoneData(initialZoneData);
  }, []); // initialZoneData is stable

  // Effect to sync form with external changes if a zone is being edited
  useEffect(() => {
    if (editingZone && editingZone.id === selectedZoneId) {
      const currentZoneInApp = eventZones.find(z => z.id === editingZone.id);
      if (currentZoneInApp) {
        // Check if geometric properties differ to avoid overwriting user input unnecessarily
        // or causing render loops if other parts of newZoneData are also in dependency arrays elsewhere.
        if (
          newZoneData.x !== currentZoneInApp.x ||
          newZoneData.y !== currentZoneInApp.y ||
          newZoneData.radius !== currentZoneInApp.radius
        ) {
          setNewZoneData(prevData => ({
            ...prevData, // Preserve other form fields like commandName, color, etc.
            x: currentZoneInApp.x,
            y: currentZoneInApp.y,
            radius: currentZoneInApp.radius,
          }));
        }
      } else {
        // Zone being edited was deleted or deselected from outside
        // handleCancel(); // This might be too aggressive if merely deselected.
                       // If it's deleted, App.tsx should clear selectedZoneId.
                       // If selectedZoneId is cleared, other logic should handle closing.
      }
    }
  }, [eventZones, selectedZoneId, editingZone, newZoneData.x, newZoneData.y, newZoneData.radius]); // Rerun if relevant parts of newZoneData change too

  useEffect(() => {
    if (pendingEventZoneCreation) {
      handleStartCreate();
      setNewZoneData(prev => ({
        ...(prev as Omit<EventZone, 'id'>),
        x: pendingEventZoneCreation.x,
        y: pendingEventZoneCreation.y,
      }));
      clearPendingEventZoneCreation();
    }
  }, [pendingEventZoneCreation, clearPendingEventZoneCreation, handleStartCreate]);

  const handleEdit = (zone: EventZone) => {
    setEditingZone(zone);
    setSelectedZoneId(zone.id); // Also select the zone when editing starts
    setIsCreatingNew(false);
    setNewZoneData(zone); // Populate form with existing data
  };

  // Effect to open editor if a zone is selected on canvas and not already being edited
  useEffect(() => {
    if (selectedZoneId && editingZone?.id !== selectedZoneId && !isCreatingNew) {
      const zoneToEdit = eventZones.find(z => z.id === selectedZoneId);
      if (zoneToEdit) {
        handleEdit(zoneToEdit);
      } else {
         // Selected zone not found (e.g. deleted from another source), so clear editing state
        handleCancel();
      }
    } else if (!selectedZoneId && !isCreatingNew && editingZone) {
      // No zone selected on canvas, and not creating new, so close editor if it was open
      handleCancel();
    }
  }, [selectedZoneId, eventZones, editingZone, isCreatingNew]); // Removed handleEdit from deps for now, assuming it's stable or this effect is simpler.

  const handleSave = () => {
    if (isCreatingNew) {
      onAddEventZone(newZoneData as Omit<EventZone, 'id'>);
    } else if (editingZone) {
      // When updating, ensure all fields from newZoneData are applied to the existing editingZone structure
      // This includes potentially undefined fields if the form allows clearing them.
      // However, the ID must come from editingZone.
      const updatedZoneFromForm = { ...editingZone, ...newZoneData, id: editingZone.id };
      onUpdateEventZone(updatedZoneFromForm);
    }
    setIsCreatingNew(false);
    setEditingZone(null);
  };

  const handleCancel = () => {
    setIsCreatingNew(false);
    setEditingZone(null);
    // Optionally, deselect zone on cancel if it's not the selected one from canvas:
    // if (editingZone?.id === selectedZoneId) setSelectedZoneId(null); 
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isNumber = type === 'number';
    // const isCheckbox = type === 'checkbox'; // Not used currently

    setNewZoneData(prev => ({
      ...prev,
      // [name]: isCheckbox ? (e.target as HTMLInputElement).checked : (isNumber ? parseFloat(value) : value),
      [name]: isNumber ? parseFloat(value) : value,
    }));
  };

  const renderZoneForm = () => (
    <div className="p-3 bg-background-primary rounded-md shadow space-y-3 mb-4">
      <h4 className="font-semibold text-text-primary">
        {isCreatingNew ? 'Create New Event Zone' : `Editing Zone: ${editingZone?.commandName}`}
      </h4>
      <div>
        <label htmlFor="commandName" className="text-sm text-text-secondary block">Command Name</label>
        <input type="text" name="commandName" value={newZoneData.commandName} onChange={handleInputChange} className="w-full p-1.5 bg-background-secondary border border-border-color rounded-md text-text-primary text-sm" placeholder="e.g., IntakeCargo" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="x" className="text-sm text-text-secondary block">X (m)</label>
          <input type="number" name="x" step="0.1" value={newZoneData.x} onChange={handleInputChange} className="w-full p-1.5 bg-background-secondary border border-border-color rounded-md text-text-primary text-sm" placeholder="Center X coordinate" />
        </div>
        <div>
          <label htmlFor="y" className="text-sm text-text-secondary block">Y (m)</label>
          <input type="number" name="y" step="0.1" value={newZoneData.y} onChange={handleInputChange} className="w-full p-1.5 bg-background-secondary border border-border-color rounded-md text-text-primary text-sm" placeholder="Center Y coordinate" />
        </div>
      </div>
      <div>
        <label htmlFor="radius" className="text-sm text-text-secondary block">Radius (m)</label>
        <input type="number" name="radius" min="0.1" step="0.1" value={newZoneData.radius} onChange={handleInputChange} className="w-full p-1.5 bg-background-secondary border border-border-color rounded-md text-text-primary text-sm" placeholder="Zone radius in meters" />
      </div>
      <div>
        <label htmlFor="triggerType" className="text-sm text-text-secondary block">Trigger Type</label>
        <select name="triggerType" value={newZoneData.triggerType} onChange={handleInputChange} className="w-full p-1.5 bg-background-secondary border border-border-color rounded-md text-text-primary text-sm">
          <option value="onEnter">On Enter</option>
          <option value="whileInZone">While In Zone</option>
        </select>
      </div>
      {newZoneData.triggerType === 'whileInZone' && (
        <div>
          <label htmlFor="onExitCommandName" className="text-sm text-text-secondary block">On Exit Command Name (Optional)</label>
          <input type="text" name="onExitCommandName" value={newZoneData.onExitCommandName || ''} onChange={handleInputChange} className="w-full p-1.5 bg-background-secondary border border-border-color rounded-md text-text-primary text-sm" placeholder="e.g., StopIntake" />
        </div>
      )}
      <div>
        <label htmlFor="color" className="text-sm text-text-secondary block">Display Color</label>
        <input type="color" name="color" value={newZoneData.color || '#FFA500'} onChange={handleInputChange} className="w-full h-8 p-0 border-none rounded-md cursor-pointer" />
      </div>
      <div className="flex justify-end space-x-2 pt-2">
        <button onClick={handleCancel} className="p-2 rounded-md text-text-secondary hover:bg-background-tertiary flex items-center"><XCircle size={16} className="mr-1"/> Cancel</button>
        <button onClick={handleSave} className="p-2 px-3 rounded-md bg-accent-primary text-white hover:bg-accent-secondary flex items-center"><Save size={16} className="mr-1"/> Save</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Standardized Header */}
      <h3 className="text-lg font-semibold text-text-primary mb-3 border-b border-border-color-primary pb-1">Event Zones</h3>
      
      {/* "Add New Zone" button, shown only when no form is active */}
      {(!isCreatingNew && !editingZone) && (
        <button
          onClick={handleStartCreate}
          className="w-full flex items-center justify-center bg-accent-success text-white py-2 px-4 rounded-md hover:bg-opacity-80 transition-colors duration-150 ease-in-out mb-3 shadow disabled:opacity-50 disabled:cursor-not-allowed"
          title="Add New Event Zone"
        >
          <PlusCircle size={18} className="mr-2" /> Add New Zone
        </button>
      )}

      {(isCreatingNew || editingZone) && renderZoneForm()}

      {eventZones.length === 0 && !isCreatingNew && !editingZone && (
        <p className="text-text-secondary text-sm text-center py-3">No event zones defined. Click 'Add Zone' to create one.</p>
      )}

      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {eventZones.map(zone => {
          const isSelected = zone.id === selectedZoneId;
          const isEditingThis = editingZone?.id === zone.id;
          let ringClass = '';
          if (isEditingThis) ringClass = 'ring-2 ring-accent-primary'; // Editing has priority for ring
          else if (isSelected) ringClass = 'ring-2 ring-accent-info'; // Selected but not editing

          return (
            <div 
              key={zone.id} 
              className={`p-2.5 bg-background-primary rounded-md shadow-sm flex justify-between items-center group ${ringClass} ${isSelected && !isEditingThis ? 'bg-opacity-80' : ''}`}
            >
              <div className="flex-grow min-w-0">
                <p className="font-medium text-text-primary text-sm truncate group-hover:text-clip">
                  <span style={{ color: zone.color, marginRight: '8px' }}>●</span> 
                  {zone.commandName}
                </p>
                <p className="text-xs text-text-tertiary truncate group-hover:text-clip">
                  ID: {zone.id.substring(5,12)} | ({zone.x.toFixed(1)}, {zone.y.toFixed(1)}) R: {zone.radius.toFixed(1)}m | {zone.triggerType}
                  {zone.triggerType === 'whileInZone' && zone.onExitCommandName ? ` | Exit: ${zone.onExitCommandName.substring(0,10)}${zone.onExitCommandName.length > 10 ? '...' : '' }` : ''}
                </p>
              </div>
              <div className="flex space-x-1.5 flex-shrink-0 ml-2">
                <button onClick={() => handleEdit(zone)} title="Edit Zone" className="p-1.5 text-text-secondary hover:text-accent-primary rounded"><Edit3 size={14} /></button>
                <button onClick={() => onDeleteEventZone(zone.id)} title="Delete Zone" className="p-1.5 text-text-secondary hover:text-error-color rounded"><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EventZoneEditor; 