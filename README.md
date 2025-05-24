# Holonomic Path Optimizer & Simulator

**Live Demo: [https://plyotam.github.io/react-testing/](https://plyotam.github.io/react-testing/)**

This application is a web-based tool for designing, optimizing, and simulating 2D paths for holonomic robots. It allows users to intuitively create paths using waypoints, configure robot and field parameters, and visualize the resulting motion profile, including velocity and acceleration.

## Features

*   **Interactive Canvas:**
    *   Click to add waypoints (Hard or Guide).
    *   Drag existing waypoints to reposition them.
    *   Visual representation of the field, grid, waypoints, optimized path, and robot.
    *   Pan and Zoom (Implicit via browser, canvas resizes to available space).
    *   **Measuring Tool:** Activate a ruler mode to click two points on the canvas and measure the distance between them, with live preview.
*   **Waypoint Customization:**
    *   **Hard Waypoints:** The robot must pass through the center of these points.
    *   **Guide Waypoints:** The path will be "attracted" towards these points, but the robot does not need to pass directly through them.
        *   **Guide Influence:** A slider (0 to 1) controls how strongly the path is pulled towards a guide waypoint.
    *   **Floating Waypoint Editor:** Click a waypoint to open a draggable editor with detailed settings:
        *   Position (X, Y)
        *   Radius (visual only, but also used for selection and simulation events)
        *   Target Velocity at waypoint
        *   Maximum Velocity Constraint within waypoint radius
        *   Target Heading (robot orientation) at waypoint
        *   Stop at Waypoint: Option to make the robot come to a complete stop.
            *   Stop Duration: Specify how long the robot should wait.
*   **Path Generation & Optimization:**
    *   **Spline-Based Paths:** Choose between Cubic or Quintic splines for path interpolation.
    *   **Velocity Profiling:** The application calculates a smooth velocity profile along the path, respecting:
        *   Robot's maximum velocity and acceleration.
        *   Curvature-based speed reduction (slows down on tighter turns).
        *   Waypoint-specific target velocities and maximum velocity constraints.
        *   Smooth acceleration and deceleration.
    *   **Guide Point Influence:** The path is dynamically adjusted to pass near guide waypoints based on their influence.
*   **Simulation:**
    *   Play, Stop, and control simulation speed (1x, 2x, 4x).
    *   Visual robot model follows the optimized path.
    *   Robot orientation interpolates between specified waypoint headings.
    *   Handles stopping at waypoints for the specified duration.
    *   **Simulation Time Slider:** A draggable slider appears below the canvas during simulation or when a path is present, allowing users to scrub through the simulation timeline. The robot's position on the canvas and the time indicator on graphs update accordingly.
    *   **Floating Simulation Graphs:**
        *   A draggable and closable window can be opened to display live simulation data.
        *   Shows **Velocity vs. Time** and **Acceleration vs. Time** charts.
        *   Individual chart visibility can be toggled.
        *   A vertical line indicates the current simulation time, synchronized with the time slider and playback.
*   **Configuration Panel (Sidebar):**
    *   **Field Settings:**
        *   Width & Height (meters)
        *   Pixels Per Meter (for canvas scaling)
        *   Show/Hide Grid
        *   Grid Spacing (meters)
    *   **Robot Settings:**
        *   Radius (meters)
        *   Mass (kg)
        *   Maximum Velocity (m/s)
        *   Maximum Acceleration (m/s²)
        *   Maximum Angular Velocity (deg/s)
        *   Maximum Angular Acceleration (deg/s²)
    *   **Waypoint List:**
        *   Displays all current waypoints.
        *   Click to select and open the editor.
        *   Quick delete button for each waypoint.
        *   **Drag-and-Drop Reordering:** Change the order of waypoints by dragging them within the list.
*   **Path Management:**
    *   **Path Name:** Editable name for the current path.
    *   **Import/Export:** Save and load paths (including waypoints and configuration) as JSON files.
    *   **Load Background Image:** Customize the canvas background with an image (e.g., a field map).
    *   **Clear Path:** Remove all waypoints and reset the path.
*   **Visualizations:**
    *   **Path Color Coding:** Path segments are colored based on the robot's velocity (red for slow, green for fast).
    *   **Waypoint Indicators:** Distinct visuals for hard vs. guide waypoints, selected waypoints, and heading targets.
    *   **Optimization Metrics:** Displays total path distance and estimated time.

## How to Use

### 1. Setting Up the Field and Robot

*   Use the **Configuration Panel** on the right (toggle with the <kbd><Settings /> Settings</kbd> icon) to adjust:
    *   **Field Settings:** Define the dimensions of your environment, grid visibility, and spacing.
    *   **Robot Settings:** Input your robot's physical parameters like radius, mass, and maximum performance values (velocity, acceleration). These are crucial for accurate path optimization and simulation.

### 2. Creating Waypoints

*   **Select Waypoint Type:** In the header, use the toggle buttons to choose between creating:
    *   **`Waypoint` (Hard):** The robot will pass directly through this point.
    *   **`GuidePoint` (Guide):** The path will be influenced to pass near this point.
*   **Adding Waypoints:** Click anywhere on the canvas to add a waypoint of the selected type at that location.
*   **Moving Waypoints:** Click and drag an existing waypoint to change its position.
*   **Reordering Waypoints:** In the **Waypoint List** (sidebar), click and drag a waypoint using the <kbd><GripVertical /> Grip</kbd> icon to change its order in the path.
*   **Waypoint Counter:** The header displays the current number of waypoints (`<Target /> X Waypoints`).

### 3. Editing Waypoints

*   **Select a Waypoint:** Click on any waypoint on the canvas. This will open the **Waypoint Editor Popup**.
*   The popup is draggable, allowing you to position it conveniently.
*   **In the Waypoint Editor:**
    *   **Position (X, Y):** Fine-tune the waypoint's coordinates.
    *   **Radius:** Adjust the visual radius of the waypoint.
    *   **Target Velocity:** Specify the desired velocity of the robot as it passes *through* this waypoint (if it's a hard waypoint and not a stop point).
    *   **Max Velocity Constraint:** Set a maximum speed the robot should not exceed while near this waypoint.
    *   **Target Heading:** Define the desired orientation (in degrees) of the robot at this waypoint. A line indicator will appear on the canvas.
    *   **Stop at Waypoint (Toggle):**
        *   If enabled, the robot will come to a complete stop at this waypoint.
        *   **Stop Duration (s):** Appears when "Stop at Waypoint" is active. Set how long the robot should pause.
    *   **Is Guide Point (Toggle):**
        *   Switch the waypoint type between Hard and Guide.
        *   **Guide Influence (Slider):** Appears when "Is Guide Point" is active. Controls how strongly the path is pulled towards this guide point (0 = no influence, 1 = strong influence).
    *   **Delete Waypoint:** Click the <kbd><Trash2 /> Trash</kbd> icon in the editor to remove the selected waypoint.
    *   **Close Editor:** Click the <kbd>X</kbd> icon to close the popup.

### 4. Path Generation and Visualization

*   The path automatically generates and updates as you add or modify waypoints (requires at least two hard waypoints).
*   **Spline Type:** In the main Configuration Panel (Path settings, though not directly editable in UI yet, defaults to Cubic), you can choose the spline type for path interpolation. (Currently, this is set in the `defaultConfig` and can be changed in code).
*   **Path Color:** The path is color-coded by velocity (green for faster, red for slower). This can be toggled in `defaultConfig` (`path.velocityVisualization`).
*   **Optimization Metrics:** The header displays the total calculated distance and time for the optimized path (`<Zap /> 0.00m • 0.00s`).

### 5. Simulating the Path

*   **Play/Stop:**
    *   Click the <kbd><Play /> Play</kbd> icon in the header to start the simulation. The robot model will follow the path.
    *   Click the <kbd><Square /> Stop</kbd> icon (same button) to pause/end the simulation.
*   **Simulation Speed:** Click the <kbd>1x</kbd> button (cycles through 1x, 2x, 4x) to change the playback speed.
*   **Simulation Time Slider:**
    *   When a path is generated, a time slider appears below the canvas.
    *   Drag the slider handle to "scrub" through the path. The robot on the canvas and the time indicator on any open graphs will update to the selected time.
    *   The slider also updates live during simulation playback.
*   **Floating Simulation Graphs:**
    *   Click the <kbd><BarChart2 /> Show Graphs</kbd> icon in the header to open the **Floating Graph Popup**.
    *   This window is draggable and can be closed with its <kbd>X</kbd> button.
    *   It displays **Velocity vs. Time** and **Acceleration vs. Time** charts for the last/current simulation.
    *   Use the checkboxes within the popup to toggle the visibility of individual charts.
    *   A vertical red dashed line on the charts indicates the current simulation time, synchronized with playback and the time slider.

### 6. Measuring Distances

*   **Activate Ruler:** Click the <kbd><Ruler /> Measure</kbd> icon in the header. The button will highlight, indicating measuring mode is active.
*   **First Point:** Click anywhere on the canvas to set the first measurement point. A crosshair will appear.
*   **Second Point & Preview:** As you move the mouse, a dashed line will preview the measurement from the first point to your cursor, and the live distance will be displayed. Click again to set the second measurement point.
*   **View Measurement:** Once two points are set, a solid line connects them, and the final measured distance is displayed on the canvas.
*   **Reset/New Measurement:**
    *   To start a new measurement, simply click again on the canvas; this will become the first point of the new measurement.
    *   To exit measuring mode, click the <kbd><Ruler /> Measure</kbd> icon in the header again.
*   **Styling:** Measured points are shown as orange crosshairs with numbers, the line is orange, and the distance text is light grey on a dark semi-transparent background.

### 7. Managing Paths and Configuration

*   **Path Name:** Click on "Steamplanner" (or the current path name) in the header to edit it.
*   **Load Background Image:** Click the <kbd><Image /> Image</kbd> icon to upload an image file to use as the canvas background.
*   **Import Path:** Click the <kbd><Upload /> Upload</kbd> icon to load a previously saved path from a JSON file. This will restore waypoints and configuration settings.
*   **Export Path:** Click the <kbd><Download /> Download</kbd> icon to save the current path (waypoints, name, and configuration) to a JSON file.
*   **Clear Path:** Click the <kbd><RotateCcw /> Clear Path</kbd> icon to remove all waypoints and reset the current path.
*   **Toggle Configuration Panel:** Click the <kbd><Settings /> Settings</kbd> icon to show or hide the right sidebar containing field/robot settings and the waypoint list.
*   **Waypoint List (in Sidebar):**
    *   Provides a scrollable list of all waypoints.
    *   Displays key information: coordinates, velocity/stop status, heading.
    *   Click an item to select it and open its editor.
    *   Each item has a <kbd><Trash2 /> Trash</kbd> icon for quick deletion.
    *   Drag waypoints using the <kbd><GripVertical /> Grip</kbd> icon to reorder them.

## Path Optimization and Physics

### 1. Path Generation

1.  **Hard Waypoints:** These form the primary skeleton of the path.
2.  **Guide Waypoint Influence:**
    *   For each segment between two hard waypoints, the algorithm identifies nearby "influential" guide waypoints.
    *   A guide point's influence is determined by its proximity to the segment and its user-defined `guideInfluence` value.
    *   The path segment is then "pulled" towards these guide waypoints. New intermediate points are inserted into the path based on this attraction.
3.  **Spline Interpolation:**
    *   The resulting sequence of points (from hard waypoints + attracted points from guide waypoints) is used to generate a smooth path using either **Cubic Splines** or **Quintic Splines**.
    *   These splines ensure continuity in position, and for quintic, also in velocity and acceleration at the knot points (the input waypoints).

### 2. Velocity Profiling (Kinematics)

The application calculates a time-optimal velocity profile along the generated spline path, subject to various constraints:

*   **Robot's Maximum Velocity & Acceleration:** The robot never exceeds its defined `maxVelocity` and `maxAcceleration`.
*   **Curvature-Based Speed Limiting:** The robot automatically slows down on tighter curves. The maximum speed on a curve is proportional to `sqrt(maxAcceleration / curvature)`.
*   **Waypoint Constraints:**
    *   **Target Velocity:** If a waypoint has a `targetVelocity` defined (and is not a stop point), the optimizer tries to achieve this speed at the waypoint.
    *   **Max Velocity Constraint:** If a waypoint has a `maxVelocityConstraint`, the speed will not exceed this value in its vicinity.
    *   **Stop at Waypoint:** If enabled, the velocity at the waypoint becomes zero. The profile includes deceleration to stop and, after the `stopDuration`, acceleration back to path speed.
*   **Forward Pass (Acceleration):** The path is traversed forward, calculating the maximum possible velocity at each point by accelerating from the previous point's velocity, respecting all constraints.
*   **Backward Pass (Deceleration):** The path is then traversed backward, ensuring that the robot can decelerate smoothly to meet future constraints (like a stop point or a lower speed segment) without violating maximum deceleration (which is the same as `maxAcceleration` in magnitude).
*   The final velocity at each point on the path is the minimum of the velocities calculated in the forward and backward passes.

### 3. Time Calculation

*   Once the velocity at each discrete point along the path is known, the time taken to traverse each small segment is calculated using `deltaTime = distance / averageVelocity` or by integrating acceleration.
*   The total time for the path is the sum of these delta times.

### 4. Energy Consumption (Simplified)

A simplified energy consumption metric is calculated based on:
*   Work done against friction: `0.5 * frictionCoefficient * mass * g * distance_segment`
*   Work done for acceleration: `mass * acceleration * distance_segment` (This is a simplification, actual motor power curves are more complex).
The power is calculated at each segment and multiplied by the segment's duration to estimate energy.

## Development

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

### Available Scripts

In the project directory, you can run:

*   `npm start`: Runs the app in development mode.
*   `npm test`: Launches the test runner.
*   `npm run build`: Builds the app for production to the `build` folder.
*   `npm run eject`: (Use with caution) Ejects from Create React App.

---

This README provides a comprehensive guide to using and understanding the Holonomic Path Optimizer. Feel free to contribute or report issues!
