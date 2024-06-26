import Project from '../graphQL/resolvers/query';
import { MarketplaceController } from '../interfaces';
import { Projects, Users } from '../models/reactypeModels';
import mongoose from 'mongoose';

// array of objects, objects inside
// type Projects = { project: {} }[];

const marketplaceController: MarketplaceController = {
  /**
   * Middleware function to find and return all published projects from the database.
   *
   * @callback GetPublishedProjectsMiddleware
   * @param {object} req - The request object.
   * @param {object} res - The response object.
   * @param {Function} next - The next middleware function in the stack.
   * @returns {void}
   */
  getPublishedProjects: async (req, res, next) => {
    try {
      const projects = await Projects.find({ published: true }).exec();
      // returns the entire project document as an array
      // need to convert each project document to an object
      const convertedProjects = projects.map((project) => {
        return project.toObject({ minimize: false });
      });
      res.locals.publishedProjects = convertedProjects;
      return next();
    } catch (err) {
      return next({
        log: `Error in marketplaceController.getPublishedProjects: ${err}`,
        message: {
          err: 'Error in marketplaceController.getPublishedProjects, check server logs for details'
        }
      });
    }
  },

  /**
   * Middleware function to publish a project to the database.
   *
   * @callback PublishProjectMiddleware
   * @param {object} req - The request object.
   * @param {object} res - The response object.
   * @param {Function} next - The next middleware function in the stack.
   * @returns {Promise<void>}
   */
  publishProject: async (req, res, next): Promise<void> => {
    const { _id, project, comments, name } = req.body;
    const username = req.cookies.username;
    const userId = req.cookies.ssid;
    const createdAt = Date.now();

    try {
      if (mongoose.isValidObjectId(_id)) {
        const noPub = { ...project };
        delete noPub.published;
        delete noPub._id;
        const publishedProject = await Projects.findOneAndUpdate(
          // looks in projects collection for project by Mongo id
          { _id },
          // update or insert the project
          {
            project: noPub,
            createdAt,
            published: true,
            comments,
            name,
            userId,
            username
          },
          // Options:
          // upsert: true - if none found, inserts new project, otherwise updates it
          // new: true - returns updated document not the original one
          { upsert: true, new: true }
        );
        res.locals.publishedProject = publishedProject;
        return next();
      } else {
        const noId = { ...project };
        delete noId._id; //removing the empty string _id from project
        delete noId.published;
        const publishedProject = await Projects.create({
          project: noId,
          createdAt,
          published: true,
          comments,
          name,
          userId,
          username
        });
        res.locals.publishedProject = publishedProject.toObject({
          minimize: false
        });
        return next();
      }
    } catch {
      // we should not expect a user to be able to access another user's id, but included error handling for unexpected errors
      return next({
        log: 'Error in marketplaceController.publishProject',
        message: {
          err: 'Error in marketplaceController.publishProject, check server logs for details'
        }
      });
    }
  },

  /**
   * Middleware function to mark a project as unpublished in the database.
   *
   * @callback UnpublishProjectMiddleware
   * @param {object} req - The request object.
   * @param {object} res - The response object.
   * @param {Function} next - The next middleware function in the stack.
   * @returns {void}
   */

  unpublishProject: (req, res, next): void => {
    const { _id } = req.body;
    const userId = req.cookies.ssid;
    //check if req.cookies.ssid matches userId

    try {
      Projects.findOneAndUpdate(
        { _id, userId },
        { published: false },
        { new: true },
        (err, result) => {
          if (err || result === null) {
            return next({
              log: `Error in marketplaceController.unpublishProject: ${
                err || null
              }`,
              message: {
                err: 'Error in marketplaceController.unpublishProject, check server logs for details'
              }
            });
          }
          res.locals.unpublishedProject = result.toObject({ minimize: false });
          return next();
        }
      );
    } catch {
      // we should not expect a user to be able to access another user's id, but included error handling for unexpected errors
      return next({
        log: `Error in marketplaceController.unpublishProject`,
        message: {
          err: 'Error in marketplaceController.unpublishProject, userId of project does not match cookies.ssid'
        }
      });
    }
  },

  /**
   * Middleware function to clone and save a project to a user's library.
   *
   * @callback CloneProjectMiddleware
   * @param {object} req - The request object.
   * @param {object} res - The response object.
   * @param {Function} next - The next middleware function in the stack.
   * @returns {Promise<void>}
   */
  cloneProject: async (req, res, next): Promise<void> => {
    // pulls cookies from request
    const userId = req.cookies.ssid;
    const username = req.cookies.username;
    try {
      // trying to find project, update its userId and username to a new project, then save it
      const originalProject = await Projects.findOne({
        _id: req.params.docId
      }).exec();
      const updatedProject = originalProject.toObject({ minimize: false }); // minimize false makes sure Mongoose / MongoDB does not remove nested properties with values of empty objects {}
      updatedProject.userId = userId;
      updatedProject.project.forked = true;
      updatedProject.published = false;
      updatedProject.forked = `Forked from ${updatedProject.username}`; // add forked tag with current project owner username
      updatedProject.username = username; // then switch to the cloning username
      delete updatedProject._id; // removes the old project id from the object
      updatedProject.createdAt = Date.now();
      const clonedProject = await Projects.create(updatedProject);
      res.locals.clonedProject = clonedProject.toObject({ minimize: false }); // need to convert back to an object to send to frontend, again make sure minimize is false
      return next();
    } catch (err) {
      return next({
        log: `Error in marketplaceController.cloneProject: ${err}`,
        message: {
          err: 'Error in marketplaceController.cloneProject, check server logs for details'
        }
      });
    }
  }
};
export default marketplaceController;
